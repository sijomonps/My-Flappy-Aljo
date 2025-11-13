# Firebase Setup Instructions for Flappy Aljo

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enter a project name (e.g., "Flappy-Aljo")
4. Follow the setup wizard (you can disable Google Analytics if not needed)

## Step 2: Set Up Realtime Database

1. In your Firebase project, go to **Build** → **Realtime Database**
2. Click "Create Database"
3. Choose a location (closest to your users)
4. Start in **Test mode** (for development)
   - **Important**: Update security rules later for production!

### Security Rules (for development):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### Security Rules (for production - recommended):
```json
{
  "rules": {
    "leaderboard": {
      ".read": true,
      ".write": true,
      ".indexOn": ["score"]
    },
    "players": {
      ".read": true,
      "$playerId": {
        ".write": true
      }
    }
  }
}
```

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the **gear icon** (⚙️) → **Project settings**
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "Flappy Aljo Web")
5. Copy the `firebaseConfig` object

## Step 4: Update Your Game Code

Open `index.html` and find the Firebase configuration section (around line 217):

```javascript
// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

**Replace** the placeholder values with your actual Firebase configuration values.

### Example:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567",
    authDomain: "flappy-aljo.firebaseapp.com",
    databaseURL: "https://flappy-aljo-default-rtdb.firebaseio.com",
    projectId: "flappy-aljo",
    storageBucket: "flappy-aljo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

## Step 5: Test Your Integration

1. Open your game in a web browser
2. Enter a player name
3. Play the game
4. Check your Firebase Realtime Database - you should see:
   - `leaderboard/` with score entries
   - `players/` with player data

## Features Included

✅ **Player Name Storage** - Name saved in localStorage and Firebase
✅ **Leaderboard** - Top 10 scores displayed after game over
✅ **Personal Best Tracking** - Each player's best score is saved
✅ **Name Change Option** - Players can change their name anytime
✅ **Persistent Identity** - Unique player ID generated and stored

## Troubleshooting

### "Firebase not configured" message
- Make sure you've replaced all placeholder values in `firebaseConfig`
- Check browser console (F12) for error messages
- Verify your `databaseURL` matches your Firebase project

### Leaderboard not showing names/scores or not sorting
1. **Check Console Logs**: Press F12 → Console tab
   - Look for "Loaded scores:" message
   - Check if scores array has data
   
2. **Verify Data Structure**: In Firebase Console → Realtime Database
   - Should see `leaderboard/` with entries like `player_xxxxx_timestamp`
   - Each entry should have: `playerName`, `score`, `playerId`, `timestamp`
   
3. **Check Database Rules**:
   ```json
   {
     "rules": {
       "leaderboard": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```

4. **Test Data**: Manually add test data in Firebase Console:
   ```json
   {
     "leaderboard": {
       "test_1": {
         "playerName": "Test Player",
         "score": 100,
         "playerId": "test_id",
         "timestamp": 1234567890
       }
     }
   }
   ```

### Leaderboard not loading
- Verify your database URL is correct (should end with `.firebaseio.com`)
- Check if database rules allow read access
- Open browser console to see error details
- Look for "Loading leaderboard..." message

### Scores not saving
- Verify database rules allow write access
- Check browser console for "Score saved to Firebase" message
- Make sure you entered a player name before playing
- Ensure you have internet connection
- Check Firebase Console → Database to see if data appears

### Sorting Issues
The leaderboard now:
- Fetches ALL scores from Firebase
- Sorts by score (highest to lowest)
- If scores are equal, sorts by timestamp (earliest first)
- Shows top 10 only
- Current player highlighted in cyan with border

## Security Note

⚠️ **Important**: The current setup uses test mode for easy development. Before deploying to production:
1. Update Firebase security rules (see production rules above)
2. Consider adding rate limiting
3. Add data validation rules
4. Monitor your database usage

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs/database/web/start)
- [Firebase Console](https://console.firebase.google.com/)
- Check browser console (F12) for detailed error messages
