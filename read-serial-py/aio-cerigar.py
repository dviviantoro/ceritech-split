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
            bean_temp = float(received_data[1])
            lux = float(received_data[2])
            ambient_temp = float(received_data[3])
            ambient_hum = float(received_data[4])
            volt_battery = float(received_data[5])
            charge_bettery = bool(received_data[6])

            point_cerigar = (
                Point("cerigar")
                # .time(timestamp_influx)
                .tag("device", device_id)
                .field("b_temp", bean_temp)
                .field("lux", lux)
                .field("a_temp", ambient_temp)
                .field("a_hum", ambient_hum)
                .field("v_bat", volt_battery)
                .field("c_bat", charge_bettery)
            )

            try:
                write_api.write(bucket=bucket, org="nusameta", record=[point_cerigar])
                print("[SUCCESS] Write data to influxdb")
            except Exception as e:
                print(e)

if __name__ == "__main__":
    app = App()
    loop = asyncio.get_event_loop()
    asyncio.ensure_future(app.read_serial(aioserial.AioSerial(port='/dev/ttyUSB0')))
    loop.run_forever()