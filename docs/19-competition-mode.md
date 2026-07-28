# Competition Mode — Group-then-Knockout vs Cup

| Field | Value |
| --- | --- |
| Document | Category competitionMode |
| Product | Set Point |
| Version | 0.1.0 |
| Status | Design Locked — Implemented |
| Last Updated | 2026-07-28 |

---

## 1. Decision

When Admin creates a **Category**, they choose the competition system:

| Mode | Value | Flow |
| --- | --- | --- |
| Grup → Knockout | `group_then_knockout` | Drawing → Schedule → Match → Standing → Qualify → Playoff → Champion |
| Cup / Knockout langsung | `knockout_only` | Teams → Playoff bracket → Match → Champion |

Stored on **Category** (`configuration.competitionMode`), not only Tournament — one event may mix formats across Categories.

Default (backward compatible): `group_then_knockout`.

---

## 2. Config shape

```json
{
  "competitionMode": "group_then_knockout",
  "teamSize": 2,
  "groupCount": 2,
  "teamsPerGroup": 4,
  "scoring": { "templateId": "one_set_6_gp_tb5" },
  "standings": { "qualifyTop": 2 }
}
```

or:

```json
{
  "competitionMode": "knockout_only",
  "teamSize": 2,
  "scoring": { "templateId": "one_set_6_gp_tb5" }
}
```

`Category.format` free-string remains for display/legacy; mode is authoritative for engine routing.

---

## 3. Engine gates

| Engine | `group_then_knockout` | `knockout_only` |
| --- | --- | --- |
| Drawing | Required | **Rejected** |
| Schedule | Required | **Rejected** |
| Standing | Required | **Rejected** |
| Playoff generate | From qualified standings | From active teams (seed order) |
| Match / Champion | Same | Same |

---

## 4. Knockout-only bracket (MVP)

- Entrants **2..16** (any count)
- Bracket size = **next power of 2**; pad with **byes** when N is not a power of 2
- Top seeds receive byes (classic pairing: pad nulls at end → 1 vs bye, …)
- Bye slots: no Match row; winner recorded in structure (`byeWinnerTeamId`) and used by advancement
- On generate: materialize first-round real matches; immediately materialize any next-round matches that are fully known from byes (e.g. bye vs bye → QF)
- Order: `seedRank` ASC (nulls last), then `createdAt`; re-numbered contiguous 1..N for pairing
- Pairing: classic seed within padded bracket
- Later rounds via existing advancement (10C) including bye winners as automatic verified

---

## 5. Acceptance

1. Create Category with either mode validates config
2. Drawing/Schedule/Standing blocked for `knockout_only`
3. Playoff generate works for both modes
4. Unit tests for seeded knockout 2/4/8 **and** bye cases 3/5/6/7
5. `nest build` green
