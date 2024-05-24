#include <my_collect_data.h>

const int batteryPin = 0;
const int phPin = 1;
const int redPin = 2;
const int bluePin = 3;

const int oneWirePin = 9;
const int switchPin = 10;

TxStruct sensorData;

OneWire oneWire(oneWirePin);
DallasTemperature sensorDallas(&oneWire);

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
}

void dallasRead()
{
    sensorDallas.requestTemperatures(); 
    sensorData.temp = sensorDallas.getTempCByIndex(0);
}

void phBatteryRead()
{
    const int sampling = 50;
    int sum_volt_battery = 0;
    int sum_adc_ph = 0;

    for (int i = 0; i < sampling; i++)
    {
        sum_volt_battery = sum_volt_battery + analogReadMilliVolts(batteryPin);
        sum_adc_ph = sum_adc_ph + analogRead(phPin);
        delay(10);
    }
    
    sensorData.volt_battery = (2 * sum_volt_battery / sampling) / 1000;
    sensorData.adc_ph = sum_adc_ph / sampling;
}

void readSensors() {
    dallasRead();
    phBatteryRead();

    Serial.print("Bean temp = ");
    Serial.println(sensorData.temp);
    Serial.print("Volt battery = ");
    Serial.println(sensorData.volt_battery);
    Serial.print("ADC pH = ");
    Serial.println(sensorData.adc_ph);
}