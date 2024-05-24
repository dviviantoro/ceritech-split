#include <OneWire.h>
#include <DallasTemperature.h>

struct TxStruct
{
    char id_device[32];
    float temp;
    int adc_ph;
    float volt_battery;
    bool charge_battery;
};
extern struct TxStruct sensorData;
extern const int redPin, bluePin, switchPin;

void initSensors();
void readSensors();