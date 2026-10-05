import { ALL_SERVERS, WikiMapClient, listFreeApartments, listFreeBusinesses, summarizeFree } from "../index.js";

/** Dump free inventory across all servers right now. */
const client = new WikiMapClient({ concurrency: 4 });
const snaps = await client.getAllServerSnapshots();

for (const snap of snaps) {
  const s = summarizeFree(snap.meta.server, snap);
  const apts = listFreeApartments(snap.meta.server, snap.data, 1).slice(0, 5);
  const biz = listFreeBusinesses(snap.meta.server, snap.data);
  console.log(
    `\n${snap.meta.server} @ ${snap.meta.fetchedAt.toISOString()} | houses ${s.housesFree}/${s.housesTotal} | biz ${s.businessFree}/${s.businessTotal} | apt free slots ${s.apartmentsFreeSlots}`,
  );
  for (const a of apts) {
    console.log(`  apt ${a.name}: ${a.free}/${a.total}`);
  }
  for (const b of biz) {
    console.log(`  biz FREE ${b.name} (${b.id})`);
  }
}

console.log(`\nDone. ${ALL_SERVERS.length} servers.`);
