#!/usr/bin/env node
const argv = require('yargs/yargs')(process.argv.slice(2))
.option('config_file', {
    alias: 'f',
    describe: 'cerifer config file'
})
.option('device_type', {
    alias: 'd',
    describe: 'device type (cerifer/cerigar)',
    choices: ['cerifer', 'cerigar']
})
.demandOption(['config_file', 'device_type'], 'Please provide all required arguments to run')
.help()
.argv;

const { ReadlineParser } = require('@serialport/parser-readline');
const Conf = require('conf');
const { randomUUID } = require('crypto');
const yaml = require('js-yaml');
const { start, dispatch, spawnStateless } = require('nact');
const path = require('path');
const pino = require('pino');
const { SerialPort } = require('serialport');
const { io } = require('socket.io-client');

require('dotenv').config();

const config = new Conf({
    configName: path.resolve(argv.config_file),
    fileExtension: 'yaml',
    serialize: yaml.dump,
    deserialize: yaml.load
});

const loggerConfig = {
    development: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'SYS:standard'
            },
        },
        level: 'debug'
    },
    production: true,
    testing: false
}

/**
 * helper function to logging:
 */
const log = pino(loggerConfig[process.env.APP_ENV] ?? true);

const socket = io('http://localhost:3000');


if (!config.get('ready')) {
    log.error(new Error('config is not ready yet, exiting...'));
    process.exit(1);
}

let deviceId = [];
let deviceName = [];
let mode = 0;
let calibrator = config.get('calibration.coefficient') || []; // y = mx + b

const port = config.get('serial.port') || '/dev/ttyUSB0';
const baud = config.get('serial.baudrate') || 9600;

let serialport = null;
let parser = null;
// const serialport = new SerialPort({
//     path: port,
//     baudRate: baud,
// });
// const parser = serialport.pipe(new ReadlineParser('\r\n'));

if (config.get('device.id')) {
    if (config.get('device.id').length > 0) {
        config.get('device.id').map(x => {
            deviceId = [...deviceId, x];
        });
    }
}

if (config.get('device.name')) {
    if (config.get('device.name').length > 0) {
        config.get('device.name').map(x => {
            deviceName = [...deviceName, x];
        });
    }
}

// console.log({ deviceId, deviceName });

let theValue = [];

//
deviceId.forEach((_) => {
    theValue.push(0);
});

// delay in ms
const delay = duration => new Promise((resolve) => setTimeout(() => resolve(), duration));
const system = start();

const reset = async (_msg, _error, ctx) => {
    await delay(500);
    return ctx.reset;
};

const sensorSender = spawnStateless(system, async (message, _context) => {
    try {
        //
        log.debug(`${message.sensing} on device ${message.device} value: ${message.value}`);

        //
        let idx = deviceName.findIndex(x => x === message.device);
        if (idx > -1) {
            //
            socket.emit('sensor', {
                name: message.sensing,
                owner_id: deviceId[idx],
                value: message.value,
            });
        }
    } catch (err) {
        log.error(err);
    }
}, 'sensorSender', { onCrash: reset });

const phCalibrator = spawnStateless(system, async (message, _context) => {
    // console.log({ mode });
    log.debug(`device ${message.device} value: ${message.value}`);
    try {
        if (mode === 0) {
            let idx = deviceName.findIndex(x => x === message.device);
            if (idx > -1) {
                log.debug(`pH on CH${idx + 1} value: ${message.value}`);

                // //
                // console.log(`COEFF M: ${config.get(`calibration.coefficient.${idx}.m`)}`);
                // console.log(`CONST B: ${config.get(`calibration.coefficient.${idx}.b`)}`);

                //
                if (config.get(`calibration.coefficient.${idx}.m`) * message.value + config.get(`calibration.coefficient.${idx}.b`) >= 0 && config.get(`calibration.coefficient.${idx}.m`) * message.value + config.get(`calibration.coefficient.${idx}.b`) <= 14) {
                    //
                    dispatch(sensorSender, {
                        sensing: 'ph',
                        device: deviceName[idx],
                        value: config.get(`calibration.coefficient.${idx}.m`) * message.value + config.get(`calibration.coefficient.${idx}.b`),
                    });
                } else {
                    //
                    dispatch(sensorSender, {
                        sensing: 'ph',
                        device: deviceName[idx],
                        value: -1.0,
                    });
                }
            }
        } else if (mode === 1) {
            //
            let idx = deviceName.findIndex(x => x === message.device);
            if (idx > -1) {
                theValue[idx] = message.value;
            }

            //
            // log.debug(`pH calibration value: ${theValue}`);
            // console.log(theValue);

            //
            socket.emit('calibration', {
                name: 'ph',
                value: theValue,
            });
        }
    } catch (err) {
        log.error(err);
    }
}, 'phCalibrator', { onCrash: reset });

socket.on('connect', () => {
    log.debug(`socket connected`);
    socket.emit('register', {
        service: randomUUID(),
        name: argv.device_type === 'cerigar' ? 'cerigar_sensor' : 'cerifer_sensor',
    });
});

socket.on('disconnect', (reason) => {
    log.debug(`socket disconnected`);
    if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
    }
    // else the socket will automatically try to reconnect
});

socket.on('calibrator_data', (data) => {
    if (argv.device_type === 'cerifer') {
        log.debug(`new calibration for CH${Number(data.channel)} value: ${JSON.stringify(data.coefficient)}`);
        config.set('calibration.coefficient.' + (Number(data.channel) - 1).toString(), data.coefficient);
        calibrator[(Number(data.channel) - 1)] = data.coefficient;
    }
});

socket.on('ph_mode_activation', (option) => {
    if (argv.device_type === 'cerifer') {
        log.debug(`activate mode: ${option}`);
        if (option === 0) {
            if (mode === 1) {
                mode = 0;
            }
        } else if (option === 1) {
            if (mode === 0) {
                mode = 1;
                socket.emit('channel', {
                    size: calibrator.length
                });
            }
        }
    }
});

(async () => {
    try {
        //
        const list = await SerialPort.list();
        log.debug('port list: ' + JSON.stringify(list));

        //
        let active = false;

        //
        list.forEach((x) => {
            x.path === port ? active = true : null;
        });

        // console.log({ active });

        //
        if (active) {
            serialport = new SerialPort({
                path: port,
                baudRate: baud,
            });
            parser = serialport.pipe(new ReadlineParser());
            parser.on('data', (data) => {
                log.debug(`data: ${data}`);
        
                //
                if (data) {
                    if (data.includes(';')) {
                        switch (argv.device_type) {
                            case 'cerifer':
                                const ceriferData = data.split(';') || [];
                                log.debug(`cerifer data: ${JSON.stringify(ceriferData)}`);
        
                                //
                                if (ceriferData.length >= 5) {
                                    const device = ceriferData[0];
                                    const aTemp = Number(ceriferData[1]);
                                    const adcPh = Number(ceriferData[2]);
                                    const vBatt = Number(ceriferData[3]);
                                    const cBatt = ceriferData[4];
        
                                    //
                                    dispatch(phCalibrator, {
                                        device,
                                        value: adcPh,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'temperature',
                                        device,
                                        value: aTemp,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'voltage_battery',
                                        device,
                                        value: vBatt,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'charge_battery',
                                        device,
                                        value: cBatt,
                                    });
                                }
        
                                //
                                break;
                            case 'cerigar':
                                const cerigarData = data.split(';') || [];
                                log.debug(`cerigar data: ${JSON.stringify(cerigarData)}`);
        
                                //
                                if (cerigarData.length >= 7) {
                                    const device = cerigarData[0];
                                    const bTemp = Number(cerigarData[1]);
                                    const lux = Number(cerigarData[2]);
                                    const aTemp = Number(cerigarData[3]);
                                    const aHum = Number(cerigarData[4]);
                                    const vBatt = Number(cerigarData[5]);
                                    const cBatt = cerigarData[6];
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'bean_temperature',
                                        device,
                                        value: bTemp,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'light_intensity',
                                        device,
                                        value: lux,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'temperature',
                                        device,
                                        value: aTemp,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'humidity',
                                        device,
                                        value: aHum,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'voltage_battery',
                                        device,
                                        value: vBatt,
                                    });
        
                                    //
                                    dispatch(sensorSender, {
                                        sensing: 'charge_battery',
                                        device,
                                        value: cBatt,
                                    });
                                }
        
                                //
                                break;
                        }
                    }
                }
            });
        }
    } catch (error) {
        log.error("ceritech serial error: " + error.message);
    }
})();

// if (parser) {
//     parser.on('data', (data) => {
//         log.debug(`data: ${data}`);

//         //
//         if (data) {
//             if (data.includes(';')) {
//                 switch (argv.device_type) {
//                     case 'cerifer':
//                         const ceriferData = data.split(';') || [];
//                         log.debug(`cerifer data: ${JSON.stringify(ceriferData)}`);

//                         //
//                         if (ceriferData.length >= 5) {
//                             const device = ceriferData[0];
//                             const aTemp = Number(ceriferData[1]);
//                             const adcPh = Number(ceriferData[2]);
//                             const vBatt = Number(ceriferData[3]);
//                             const cBatt = ceriferData[4];

//                             //
//                             dispatch(phCalibrator, {
//                                 device,
//                                 value: adcPh,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'temperature',
//                                 device,
//                                 value: aTemp,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'voltage_battery',
//                                 device,
//                                 value: vBatt,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'charge_battery',
//                                 device,
//                                 value: cBatt,
//                             });
//                         }

//                         //
//                         break;
//                     case 'cerigar':
//                         const cerigarData = data.split(';') || [];
//                         log.debug(`cerigar data: ${JSON.stringify(cerigarData)}`);

//                         //
//                         if (cerigarData.length >= 7) {
//                             const device = cerigarData[0];
//                             const bTemp = Number(cerigarData[1]);
//                             const lux = Number(cerigarData[2]);
//                             const aTemp = Number(cerigarData[3]);
//                             const aHum = Number(cerigarData[4]);
//                             const vBatt = Number(cerigarData[5]);
//                             const cBatt = cerigarData[6];

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'bean_temperature',
//                                 device,
//                                 value: bTemp,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'lux',
//                                 device,
//                                 value: lux,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'temperature',
//                                 device,
//                                 value: aTemp,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'humidity',
//                                 device,
//                                 value: aHum,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'voltage_battery',
//                                 device,
//                                 value: vBatt,
//                             });

//                             //
//                             dispatch(sensorSender, {
//                                 sensing: 'charge_battery',
//                                 device,
//                                 value: cBatt,
//                             });
//                         }

//                         //
//                         break;
//                 }
//             }
//         }
//     });
// }