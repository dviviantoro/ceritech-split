#include <my_collect_data.h>

const int batteryPin = 0;
const int phPin = 1;
const int redPin = 2;
const int bluePin = 3;

const int oneWirePin = 9;
const int switchPin = 10;

const int sampling = 50;

TxStruct sensorData;

OneWire oneWire(oneWirePin);
DallasTemperature sensorDallas(&oneWire);
DFRobot_SHT20 sht20(&Wire, SHT20_I2C_ADDR);
BH1750 lightMeter;

void initSensors()
{
    pinMode(switchPin, OUTPUT);
    digitalWrite(switchPin, HIGH);
    delay(50);

    sensorDallas.begin();
    pinMode(batteryPin, INPUT);
    pinMode(phPin, INPUT);
    pinMode(redPin, OUTPUT);
    pinMode(bluePin, OUTPUT);

    Wire.begin();
    sht20.initSHT20();
    lightMeter.begin();

    Serial.print("Init sensors completed");
}

int dallasSample()
{
    sensorDallas.requestTemperatures(); 
    int dallas = sensorDallas.getTempCByIndex(0);
    return dallas;
}

void collectSample()
{
    float sum_b_temp = 0;
    float sum_lux = 0;
    float sum_a_temp = 0;
    float sum_a_hum = 0;
    int sum_volt_battery = 0;

    for (int i = 0; i < sampling; i++)
    {
        sum_b_temp += dallasSample();
        sum_lux += lightMeter.readLightLevel();
        sum_a_temp += sht20.readTemperature();
        sum_a_hum += sht20.readHumidity();
        sum_volt_battery += analogReadMilliVolts(batteryPin);
        
        delay(10);
    }
    
    sensorData.b_temp = sum_b_temp / sampling;
    sensorData.lux = sum_lux / sampling;
    sensorData.a_temp = sum_a_temp / sampling;
    sensorData.a_hum = sum_a_hum / sampling;
    sensorData.volt_battery = (2 * sum_volt_battery / sampling) / 1000;
    
    Serial.print("Bean temp = ");
    Serial.println(sensorData.b_temp);
    Serial.print("Lux = ");
    Serial.println(sensorData.lux);
    Serial.print("Ambient temp = ");
    Serial.println(sensorData.a_temp);
    Serial.print("Ambient hum = ");
    Serial.println(sensorData.a_hum);
    
    Serial.print("Volt battery = ");
    Serial.println(sensorData.volt_battery);
}