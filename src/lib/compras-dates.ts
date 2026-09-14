// Sheets serials are wall-clock values in the spreadsheet's time zone.
export function sheetSerialDate(serial: number, timeZone: string) {
  const wallClock = Date.UTC(1899, 11, 30) + serial * 86_400_000;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" });
  let instant = wallClock;
  for (let attempt = 0; attempt < 3; attempt++) {
    const zoneName = formatter.formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value || "GMT";
    const offset = /^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(zoneName);
    const minutes = offset ? Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2] || 0) : 0;
    const corrected = wallClock - minutes * 60_000;
    if (corrected === instant) break;
    instant = corrected;
  }
  return new Date(instant);
}
