import { WikiMapClient } from "../index.js";

const server = (process.argv[2] ?? "blackberry") as "blackberry";

const client = new WikiMapClient();
const { meta, data } = await client.getServerSnapshot(server);

console.log(`Server: ${meta.server}`);
console.log(`Wiki snapshot: ${meta.fetchedAt.toISOString()}`);
console.log(`Apartments: ${data.apartmentHouses.length}, houses: ${data.houses.length}, business: ${data.business.length}`);

const sanVitus = data.apartmentStats.find((s) => s.houseId === 33);
if (sanVitus) {
  console.log(`1564 San Vitus (id 33): free ${sanVitus.free}/${sanVitus.total}`);
}
