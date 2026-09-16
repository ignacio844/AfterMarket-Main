import assert from "node:assert/strict";
import test from "node:test";
import { includeEscobarDeposito } from "../bridge/escobar-parse.mjs";

test("incluye sólo las categorías Escobar no bloqueadas", () => {
  for (const deposito of ["DISTRIMAR B", "DISTRIMAR N", "JUNIMAR B", "ALEMAR B", "N"]) {
    assert.equal(includeEscobarDeposito(deposito), true, deposito);
  }
  for (const deposito of ["DISTRIMAR EXT", "JUNIMAR REV", "ALEMAR INV", "ALEMAR TEP", ""]) {
    assert.equal(includeEscobarDeposito(deposito), false, deposito);
  }
});
