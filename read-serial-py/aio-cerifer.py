import asyncio
import aioserial
from dotenv import load_dotenv
import influxdb_client, os, time
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

load_dotenv()

token = os.getenv('INFLUX_TOKEN')
org = os.getenv('ORG')
url = os.getenv('URL')
bucket= os.getenv('BUCKET')

client = influxdb_client.InfluxDBClient(url=url, token=token, org=org)
write_api = client.write_api(write_options=SYNCHRONOUS)

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

            point_cerifer = (
                Point("cerifer")
                # .time(timestamp_influx)
                .tag("device", device_id)
                .field("temp", temp)
                .field("adc_ph", adc_ph)
                .field("v_bat", volt_battery)
                .field("c_bat", charge_bettery)
            )

            try:
                write_api.write(bucket=bucket, org="nusameta", record=[point_cerifer])
                print("[SUCCESS] Write data to influxdb")
            except Exception as e:
                print(e)

if __name__ == "__main__":
    app = App()
    loop = asyncio.get_event_loop()
    asyncio.ensure_future(app.read_serial(aioserial.AioSerial(port='/dev/ttyUSB0')))
    loop.run_forever()