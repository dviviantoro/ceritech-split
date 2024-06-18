#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>

typedef struct RxStruct
{
    char id_device[32];
    float b_temp;
    float lux;
    float a_temp;
    float a_hum;

    float volt_battery;
    bool charge_battery;
} RxStruct;
RxStruct sensorData;

void OnDataRecv(uint8_t * mac, uint8_t *incomingData, uint8_t len) {
    memcpy(&sensorData, incomingData, sizeof(sensorData));
    String messages = String(sensorData.id_device) + ";";
    messages += String(sensorData.b_temp) + ";";
    messages += String(sensorData.lux) + ";";
    messages += String(sensorData.a_temp) + ";";
    messages += String(sensorData.a_hum) + ";";
    messages += String(sensorData.volt_battery) + ";";
    messages += String(sensorData.charge_battery) + ";";
    Serial.println(messages);
}
 
void setup() {
    Serial.begin(9600);
    WiFi.mode(WIFI_STA);

    delay(5000);

    Serial.print("ESP Board MAC Address:  ");
    Serial.println(WiFi.macAddress());

    if (esp_now_init() != 0)
    {
        Serial.println("Error initializing ESP-NOW");
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_register_recv_cb(OnDataRecv);
}

void loop() {
    // Serial.println("hallo");
    // delay(1000);
}
