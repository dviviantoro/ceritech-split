#include <OneWire.h>
#include <DallasTemperature.h>

#include "DFRobot_SHT20.h"
#include <BH1750.h>
#include <Wire.h>

struct TxStruct
{
    char id_device[32];
    float b_temp;
    float lux;
    float a_temp;
    float a_hum;

    float volt_battery;
    bool charge_battery;
};
extern struct TxStruct sensorData;
extern const int redPin, bluePin, switchPin;

void initSensors();
void collectSample();