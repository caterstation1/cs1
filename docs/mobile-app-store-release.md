# CaterStation Staff App — App Store Release

## Overview

- **Bundle ID (iOS):** `nz.co.caterstation.staffapp` (the original `nz.co.caterstation.staff` is burned — see "Lessons learned" below; Android keeps `nz.co.caterstation.staff` since Google Play is a separate namespace and that ID was never affected)
- **Distribution:** Public app record with **unlisted distribution** (requested via Apple's unlisted app form after approval — see below). Do NOT use Apple Business Manager Custom App distribution.
- **Web content:** Loaded from `https://caterstation1.vercel.app` (no web resubmission needed for UI changes)
- **Native builds required for:** iOS plugin changes, permission strings, entitlements, app icon

## Lessons learned / unlisted distribution

The first release (bundle ID `nz.co.caterstation.staff`) was mistakenly submitted as a **private Apple Business Manager custom app** (Distribution Method = Private, org "The Dive Limited"). Apple does not allow converting a custom/private app record to unlisted distribution after approval, and a bundle ID that has had a build uploaded cannot be reused on a new app record — so that bundle ID is permanently burned and the app was re-created as `nz.co.caterstation.staffapp`.

Correct sequence for unlisted distribution:

1. Create a **new App Store Connect app record** with a **new bundle ID**.
2. Set the distribution method to **Public** (never Private/custom-app).
3. Submit for review with **manual release** (do not auto-release on approval).
4. After approval, file Apple's [unlisted app distribution request form](https://developer.apple.com/contact/request/unlisted-app/) referencing the app.
5. **Release only after** receiving the unlisted-approval email from Apple. The app is then reachable only via its direct App Store link and never appears in search or charts.

## Delivery-run location model (Guideline 2.5.4 compliance)

Background location is a **limited, temporary, driver-controlled delivery-run coordination feature** — not general employee tracking:

- Clocking in does **not** start location sharing. The clock-in dialog shows a disclosure explaining this.
- Sharing only activates when an order is marked **Dispatched** and assigned to that driver (an "active dispatched delivery run").
- While active, the driver sees a persistent in-app banner — *"Delivery run location sharing active — used for customer ETAs, dispatch coordination, and return-to-base planning"* — with a **Stop Tracking** button.
- Sharing stops automatically when the driver:
  - returns to the kitchen/base geofence (`returned_to_base`),
  - clocks out (`clock_out`),
  - taps Stop Tracking (`manual_stop`),
  - or hits the maximum-duration privacy failsafe, default 6 hours (`max_duration`).
- Completing a delivery does **not** stop sharing — dispatch still needs to see when the driver is close to base to plan the next run. Sharing ends at return-to-base/manual stop/clock-out/max-duration.
- The server rejects tracking start requests unless the staff member is authenticated, clocked in, **and** has at least one active dispatched assigned order. Location pings are only saved while the run is active.
- Eligibility counts orders delivered **today** OR orders **dispatched within the last 8 hours** (`Order.dispatchedAt`, stamped when the Dispatch button is tapped). The 8-hour window lets test/demo orders on other dates work and lets a re-dispatch restart tracking after a stop.
- Start latency: dispatching your own order triggers tracking within ~1–2 seconds; orders dispatched by someone else are picked up by the driver's app within ~20 seconds (status poll).

### Server configuration (Vercel env vars)


| Variable                          | Purpose                                               | Default                   |
| --------------------------------- | ----------------------------------------------------- | ------------------------- |
| `CATERSTATION_BASE_LAT`           | Kitchen/base latitude for the return-to-base geofence | unset (geofence disabled) |
| `CATERSTATION_BASE_LNG`           | Kitchen/base longitude                                | unset (geofence disabled) |
| `CATERSTATION_BASE_RADIUS_METERS` | Geofence radius                                       | 250 (code default)        |
| `CATERSTATION_MAX_TRACKING_HOURS` | Max-duration failsafe                                 | 6                         |


Current production values (set 13 Jul 2026): lat `-36.86131214082418`, lng `174.73404008957752` (562 Richmond Road entrance), radius `25` m — tight so drivers driving past the building to collect bread/butchery don't trigger the auto-stop; they only stop when they walk into the building.

## Build steps

1. Deploy latest web to production: `vercel --prod`
2. Sync Capacitor: `npm run cap:sync:ios`
3. Open **ios/App/App.xcworkspace** in Xcode (not `.xcodeproj`)
4. Select **App** target → **Signing & Capabilities**
  - Team: your Apple Developer team
  - Confirm **Background Modes → Location updates** is enabled
5. **Product → Archive**
6. **Distribute App → App Store Connect**
7. Submit for review with **manual release** (Public distribution — see "Lessons learned / unlisted distribution" above)

### Version numbers (Xcode)

- **Marketing version:** 1.0
- **Build:** increment for each upload

## App Store Connect checklist

### App Information

- **Name:** CaterStation Staff (or CaterStation)
- **Category:** Business
- **Content rights:** You own or have licensed all content

### Privacy

Declare data collection:

- **Location (precise):** Used only during active dispatched delivery runs for dispatch coordination
- **Contact info / identifiers:** Staff login (if applicable in privacy questionnaire)

### Location usage review notes (paste into Review Notes)

```
CaterStation Staff is an internal operations app for our catering company's delivery drivers and kitchen staff.

Background location is used ONLY during active dispatched delivery runs — never for general employee tracking:

1. Clocking in does NOT start location sharing. The clock-in screen shows a disclosure explaining this.
2. Location sharing activates only when our dispatch team marks a catering order as Dispatched and assigns it to that driver.
3. While sharing is active, the driver sees a persistent in-app banner ("Delivery run location sharing active") with a Stop Tracking button that immediately ends sharing.
4. Sharing stops automatically when the driver returns to our kitchen (geofence), clocks out, taps Stop Tracking, or after a 6-hour maximum-duration failsafe.
5. The purpose is operational delivery coordination: giving customers accurate ETAs when they call, avoiding phoning drivers while they are driving, and letting the kitchen see when a driver is returning to base for the next delivery run.

Location data is sent to our own server and used only for live dispatch coordination. It is never sold, shared, or used for advertising.

DEMO STEPS (demo staff account: peter@thecaterstation.co.nz / Test2026 — the staff profile is named "APPTEST").
The whole flow can be demonstrated on one device with this single account.

1. Log in → Dashboard → Clock In. Note the disclosure: location sharing is NOT active just because you are clocked in. No location banner appears and no location permission is requested.
2. Go to the "Realtime" tab. The first order in the list is our pre-made test order named "APP TEST", and APPTEST (the demo account) is already selected as its driver. Tap the "Dispatch" button — it turns green ("Dispatched").
3. Within a few seconds the app requests location permission and shows the persistent banner "Delivery run location sharing active" (used for customer ETAs, dispatch coordination, and return-to-base planning) with a "Stop Tracking" button.
4. Tap "Stop Tracking" (or clock out) → the banner changes to "Delivery run location sharing is now off" and background location stops immediately.
5. To repeat the flow, tap the green "Dispatched" button to un-dispatch the test order, then tap "Dispatch" again — location sharing restarts.
6. Dispatcher's view: Dashboard → "Live Map" shows the driver as "Active delivery run" with "Last delivery location update" while sharing is active, and the driver disappears from the map once sharing stops.
```

### Screenshots

Required sizes for iPhone 6.7" and 6.5" (or use Xcode Simulator screenshots):

- Dashboard (clocked in, with clock-in disclosure)
- Delivery run banner active
- Realtime orders / timesheet
- Optional: Delivery Run Live Map from admin web (not in app)

### Export compliance

`ITSAppUsesNonExemptEncryption = false` is already set in Info.plist.

## Post-release web updates

- UI, APIs, and business logic deploy via `vercel --prod`
- Staff app picks up changes on next cold start (remote URL)
- Only ship a new native build when changing plugins, permissions, or icons

## Verification checklist (delivery-run tracking workflow)

- [x] Clock-in alone does NOT start tracking (no banner, no pings recorded).
- [x] Clock-in dialog shows the delivery-run disclosure.
- [x] Marking an order Dispatched + assigning the driver starts tracking (self-dispatch: within ~2s; dispatched by someone else: within ~20s — banner appears, pings recorded).
- [x] Re-dispatching an order (un-dispatch → dispatch) restarts tracking after a manual stop.
- [x] No tracking starts for orders assigned but NOT dispatched.
- [x] No tracking starts for dispatched orders assigned to a different driver.
- [x] "Stop Tracking" button stops immediately; shift shows `trackingStopReason = manual_stop`.
- [x] Clock-out stops tracking; `trackingStopReason = clock_out`.
- [x] Driving out and re-entering the base geofence stops tracking; `trackingStopReason = returned_to_base` and the "returned to base" notice appears.
- [x] Marking the order fulfilled/completed does NOT stop tracking.
- [x] Tracking auto-stops after `CATERSTATION_MAX_TRACKING_HOURS`; `trackingStopReason = max_duration`.
- [x] Admin Live Map says "Delivery Run Live Map" / "Active delivery run" — no "employee tracking" wording anywhere.
- [x] Live Map only shows drivers with `trackingStatus = active_delivery_run`.
- [x] Location permission = Always; test on cellular (not only Wi‑Fi).

## Android (future)

Android native pings need a similar Kotlin plugin (WebView HTTP is throttled after ~5 min in background). iOS is the priority for go-live.