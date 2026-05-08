name: DOE Funding Digest

on:
  schedule:
    - cron: '0 13 1,15 * *'   # Runs at 8am CT on the 1st and 15th of every month
  workflow_dispatch:            # Also lets you trigger it manually from GitHub

jobs:
  send-digest:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install nodemailer

      - name: Run digest script
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GMAIL_USER: ${{ secrets.GMAIL_USER }}
          GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
          RECIPIENT_EMAIL: ${{ secrets.RECIPIENT_EMAIL }}
        run: node digest.js
