# NITR Attendance Mobile

Expo React Native version of the NITR Attendance Tracker.

## Current Scope

Version 1 recreates the existing PWA as an offline-first native app:

- Onboarding with name and roll number
- Dashboard with Mark IN and Mark OUT
- Attendance duration and 9-hour target logic
- Calendar view with date editing and holidays
- Stats and last 7 days chart
- Dark/light theme
- Local storage
- JSON backup export/import
- CSV export
- Native daily reminder scheduling

GPS and Firebase are intentionally planned for later versions.

## Commands

```bash
npm run start
npm run android
npm run ios
npm run web
```

On Windows, use Android or Expo Go for testing. iOS builds can later be handled with Expo Application Services.

## Project Notes

- Business logic lives in `src/attendance.ts`.
- Persistent storage lives in `src/storage.ts`.
- Backup/export helpers live in `src/backup.ts`.
- Notification scheduling lives in `src/notifications.ts`.
- Shared types live in `src/types.ts`.

## Roadmap

1. Polish the native UI against the current PWA.
2. Add proper time pickers for editing IN/OUT.
3. Improve notification handling after device testing.
4. Add Firebase auth and sync.
5. Add GPS validation near approved buildings/scanners.
