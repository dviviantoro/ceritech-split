#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>

typedef struct RxStruct
{
    char id_device[32];
    float temp;
    int adc_ph;
    float volt_battery;
    bool charge_battery;
} RxStruct;
RxStruct sensorData;

void OnDataRecv(uint8_t * mac, uint8_t *incomingData, uint8_t len) {
    memcpy(&sensorData, incomingData, sizeof(sensorData));
    String messages = "cerifer;";
    messages += String(sensorData.id_device) + ";";
    messages += String(sensorData.temp) + ";";
    messages += String(sensorData.adc_ph) + ";";
    messages += String(sensorData.volt_battery) + ";";
    messages += String(sensorData.charge_battery) + ";";
    Serial.println(messages);
}
 
void setup() {
    Serial.begin(9600);
    WiFi.mode(WIFI_STA);

    if (esp_now_init() != 0)
    {
        Serial.println("Error initializing ESP-NOW");
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_register_recv_cb(OnDataRecv);
}

void loop() {}
