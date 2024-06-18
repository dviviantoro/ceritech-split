#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <my_collect_data.h>

#define ID_DEVICE "GAR-001001"
#define uS_TO_S_FACTOR 1000000
#define TIME_TO_SLEEP  10
// 48:3F:DA:00:80:52
uint8_t broadcastAddress[] = {0x48, 0x3F, 0xDA, 0x00, 0x80, 0x52};
esp_now_peer_info_t peerInfo;
RTC_DATA_ATTR int fail_sendDataCount = 0;

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
    Serial.print("\r\nLast Packet Send Status:\t");
    Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Delivery Success" : "Delivery Fail");
    status == ESP_NOW_SEND_SUCCESS ? fail_sendDataCount = 0 : fail_sendDataCount++;
}

void print_wakeup_reason(){
    esp_sleep_wakeup_cause_t wakeup_reason;
    wakeup_reason = esp_sleep_get_wakeup_cause();

    switch(wakeup_reason)
    {
        case ESP_SLEEP_WAKEUP_EXT0:
            Serial.println("Wakeup caused by external signal using RTC_IO");
            break;
        case ESP_SLEEP_WAKEUP_EXT1:
            Serial.println("Wakeup caused by external signal using RTC_CNTL");
            break;
        case ESP_SLEEP_WAKEUP_TIMER:
            Serial.println("Wakeup caused by timer");
            break;
        case ESP_SLEEP_WAKEUP_TOUCHPAD:
            Serial.println("Wakeup caused by touchpad");
            break;
        case ESP_SLEEP_WAKEUP_ULP:
            Serial.println("Wakeup caused by ULP program");
            break;
        default:
            Serial.printf("Wakeup was not caused by deep sleep: %d\n",wakeup_reason);
            break;
    }
}

void initEspNow() 
{
    if (esp_now_init() != ESP_OK) {
        Serial.println("Error initializing ESP-NOW");
        return;
    }

    esp_now_register_send_cb(OnDataSent);
    
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;  
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) != ESP_OK){
        Serial.println("Failed to add peer");
        return;
    }
}

void setup() {
    Serial.begin(9600);
    print_wakeup_reason();
    WiFi.mode(WIFI_STA);
    
    initEspNow();
    initSensors();

    // if (result == ESP_OK)
    // {
    //     Serial.println("Send with success");
    //     digitalWrite(bluePin, HIGH);
    // }
    // else 
    // {
    //     Serial.println("Error sending the data");
    //     fail_sendDataCount++;
    //     digitalWrite(redPin, HIGH);
    // }

    collectSample();
    strcpy(sensorData.id_device, ID_DEVICE);

    esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *) &sensorData, sizeof(sensorData));

    if (fail_sendDataCount >= 4)
    {
        fail_sendDataCount = 0;
        esp_deep_sleep_enable_gpio_wakeup(BIT(D3), ESP_GPIO_WAKEUP_GPIO_HIGH);
    }
    else 
    {
        esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
    }

    Serial.println("Going to sleep now");
    digitalWrite(redPin, LOW);
    digitalWrite(bluePin, LOW);
    digitalWrite(switchPin, LOW);
    esp_deep_sleep_start();
}
    
void loop() {}