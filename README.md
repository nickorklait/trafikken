# Trafikken – Oslo-området hver morgen

An Instagram account that posts every morning at 07:00 how yesterday's traffic in the Oslo area compared
with a normal day, when the rush hours peaked, and today's rush-hour weather. On Fridays it adds when it is
busiest and quietest to leave for the cabin, and on Sundays to come home.

Built from the Aurora Tonight project (same publishing, dashboard, Reels and controls); the data, the
summary, the images and the caption are new.

## Data

- **Traffic:** Statens vegvesen's open traffic API (`trafikkdata-api.atlas.vegvesen.no`, GraphQL, NLOD).
  Vehicles per day and per hour, by direction, at fixed registration points. The points are in
  `config/config.json`: 8 commuter points in Oslo, Bærum and Asker, and 3 roads out of town for the
  cabin traffic.
- **Weather:** MET Norway's locationforecast (CC BY 4.0) for Oslo, today 07–09 and 15–17.
- **Public holidays:** computed (Easter-based), never from a list.

Everything a post uses is saved in `data/traffic/<date>.json`.

## How the numbers are made (`src/summary.ts`)

- **Yesterday** is the day before the post. A point counts only if at least 95 % of the day was measured;
  at least 6 of the 8 must be, or no post is made.
- **Normal** is the same weekday in the weeks before (the 4 most recent fully measured, no public
  holidays), for the same points as yesterday, so the comparison is like for like.
- **Rush hours:** the busiest hour 05–11 and 13–20, yesterday and normally.
- **Cabin (Fri/Sun):** vehicles per hour in the direction out of (Friday) or into (Sunday) Oslo, averaged
  over the last 4 same weekdays. *Busy* = at least 90 % of the busiest hour, *quieter* = at most 70 %.
  It counts cars, not queues, and says so.
- Every number in the caption is checked against the summary (`factCheck`); road names are skipped.

## Commands

```
npm run generate [-- --date 2026-10-28] [--refresh]   build today's post (traffic from the day before)
npm run publish [-- --dry-run | --only 2026-10-28-feed]
npm run dashboard                                      output/index.html
npm run autopilot                                      what the scheduled job runs
npm run brand                                          profile picture and texts in output/brand/
npm test
```

Locally on a PC behind a company certificate, set `NODE_OPTIONS=--use-system-ca` so Node trusts it.

## Schedule

The planlegger Worker starts the workflow at 06:50, 07:10, 07:40 and 08:40 Oslo time; GitHub's own cron
is a backup. The post is published from 07:00 and is useful until 11:00. Until the Instagram token is
added, every run builds the post and publishes nothing.
