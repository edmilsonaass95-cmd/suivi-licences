import { describe, expect, it } from "vitest";
import { getCategorieFFF, getSaisonStart } from "./categorie-fff";

// Saison 2026-2027
const SAISON = 2026;

describe("getCategorieFFF", () => {
  it.each([
    [2021, "U6"],
    [2020, "U7"],
    [2019, "U8"],
    [2018, "U9"],
    [2017, "U10"],
    [2016, "U11"],
    [2015, "U12"],
    [2014, "U13"],
    [2013, "U14"],
    [2012, "U15"],
    [2011, "U16"],
    [2010, "U17"],
    [2009, "U18"],
    [2008, "U19"],
    [2007, "U20"],
  ])("année %i -> %s (garçon)", (birthYear, expected) => {
    expect(
      getCategorieFFF(new Date(birthYear, 5, 15), "M", SAISON)
    ).toBe(expected);
  });

  it("ajoute le suffixe F pour toutes les catégories féminines", () => {
    expect(getCategorieFFF(new Date(2012, 5, 15), "F", SAISON)).toBe("U15F");
    expect(getCategorieFFF(new Date(2007, 5, 15), "F", SAISON)).toBe("U20F");
    expect(getCategorieFFF(new Date(2016, 5, 15), "F", SAISON)).toBe("U11F");
    expect(getCategorieFFF(new Date(2021, 5, 15), "F", SAISON)).toBe("U6F");
  });

  it("classe en Senior en dessous de 35 ans", () => {
    expect(getCategorieFFF(new Date(2000, 5, 15), "M", SAISON)).toBe(
      "Senior"
    );
  });

  it("classe en Vétéran à partir de 35 ans au 2 septembre", () => {
    // 35 ans exactement avant le 2 septembre 2026
    expect(getCategorieFFF(new Date(1991, 7, 1), "M", SAISON)).toBe(
      "Vétéran"
    );
    // pas encore 35 ans au 2 septembre 2026
    expect(getCategorieFFF(new Date(1991, 8, 15), "M", SAISON)).toBe(
      "Senior"
    );
  });

  it("ajoute le suffixe F pour les Séniors/Vétérans féminines", () => {
    expect(getCategorieFFF(new Date(2000, 5, 15), "F", SAISON)).toBe(
      "Senior F"
    );
  });
});

describe("getSaisonStart", () => {
  it("retourne l'année en cours à partir de juillet", () => {
    expect(getSaisonStart(new Date(2026, 6, 21))).toBe(2026);
  });

  it("retourne l'année précédente avant juillet", () => {
    expect(getSaisonStart(new Date(2027, 2, 1))).toBe(2026);
  });
});
