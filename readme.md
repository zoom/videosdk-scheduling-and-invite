# Video SDK - Scheduling and Invite Sample App

Use of this sample app is subject to our [Terms of Use](https://explore.zoom.us/en/video-sdk-terms/).

The [Zoom Video SDK for Web](https://developers.zoom.us/docs/video-sdk/web/) enables you to build custom video experiences on a webpage with Zoom's core technology. This sample app shows how to schedule Video SDK sessions and invite guests to them. Hosts sign up and sign in, then schedule a session with a date, time, timezone, duration, agenda, optional password, hold (waiting room) setting and optional cloud recording. The app creates the session through the [Video SDK REST API](https://developers.zoom.us/docs/video-sdk/api/) and stores the schedule in Postgres. It then generates a shareable invite and a private host link.

- **Guest link** (`/s/<inviteId>`): uses a random, unguessable invite ID. It does not contain the session name, role or password. Guests are prompted for the password if the session has one.
- **Host link** (`/s/<inviteId>/host`): requires the host to be signed in, and only works for the account that created the session.
- Video SDK signatures are generated on the server, so your SDK secret is never exposed to the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later, and npm. 
- A [Zoom Video SDK account](https://developers.zoom.us/docs/video-sdk/get-credentials/) with:
  - Video SDK Credentials: **SDK Key** and **SDK Secret**
  - REST API Credentials: **API Key** and **API Secret** (used by the server to create and delete sessions through the REST API)
- A [Postgres](https://www.postgresql.org/) database and its connection string. For example, a free [Neon](https://neon.tech) project works. The app creates the tables it needs on startup.

## Installation

1. Clone the repo:

   `git clone https://github.com/zoom/videosdk-scheduling-and-invite-sample.git`

2. Go to the project folder and install the dependencies:

   ```bash
   cd videosdk-scheduling-and-invite-sample
   npm install
   ```

3. Create a `.env` file in the project root (you can copy `.env.example`) and fill in your values:

   ```
   ZOOM_VSDK_KEY=
   ZOOM_VSDK_SECRET=

   ZOOM_API_KEY=
   ZOOM_API_SECRET=

   ENDPOINT_URL=http://localhost:3000
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   PORT=3000
   ```

   | Variable | Description |
   |---|---|
   | `ZOOM_VSDK_KEY` / `ZOOM_VSDK_SECRET` | Video SDK credentials used to sign the join token |
   | `ZOOM_API_KEY` / `ZOOM_API_SECRET` | Video SDK REST API credentials used to create and delete sessions |
   | `ENDPOINT_URL` | Public base URL of your app, used to build invite links (must be `https` in production) |
   | `DATABASE_URL` | Postgres connection string |
   | `PORT` | Port to run the app on (optional, defaults to `3000`) |

4. Start the app:

   - Development (with hot reload): `npm run dev`
   - Production: `npm run build`, then `npm start`

## Usage

1. Navigate to the endpoint_url or and create an account, or sign in.

2. On the **Schedule and Invite** tab, enter a session name, date, time, timezone, duration and an optional agenda and password. Choose whether to enable the waiting room (hold) and cloud recording, then click to schedule.

3. Copy the generated invite text, which includes the guest link and the password (if one was set), and send it to your guests. The host link is shown for your own use.

4. Open the **Scheduled Sessions** tab to see your upcoming sessions. Click **Join** to start a session as the host, or delete it to remove the session and invalidate its links.

5. Guests open the guest link, enter the password if prompted, and join the session.

For the full list of features and event listeners, as well as additional guides, see our [Video SDK docs](https://developers.zoom.us/docs/video-sdk/web/).


## Deploy

You can deploy this app to Render using the button below:

| Render |
|:-:|
| [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zoom/videosdk-scheduling-and-invite-sample.git)


## Need help?

If you're looking for help, try [Developer Support](https://devsupport.zoom.us) or our [Developer Forum](https://devforum.zoom.us). Priority support is also available with [Premier Developer Support](https://explore.zoom.us/docs/en-us/developer-support-plans.html) plans.

## Disclaimer

Do not expose your credentials to the client. When using the Video SDK in production, make sure to use a backend service to sign the tokens. Don't store credentials in plain text. As this is a sample app, we're using an `.env` file for the sake of simplicity.
