import asyncio
import aioserial

class App:
    async def read_serial(self, aioserial_instance: aioserial.AioSerial):
        while True:
            data: bytes = (await aioserial_instance.readline_async()).decode().strip()
            print(data.split(";"))
            received_data = data.split(";")
            device_id = received_data[0]
            temp = received_data[1]
            adc_ph = received_data[2]
            volt_battery = received_data[3]
            charge_bettery = received_data[4]

if __name__ == "__main__":
    app = App()
    loop = asyncio.get_event_loop()
    asyncio.ensure_future(app.read_serial(aioserial.AioSerial(port='/dev/ttyUSB0')))
    loop.run_forever()