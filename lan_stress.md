# AntiGravity E2E Test Suite: LAN Operation & Strategy 3 Mock
**Project:** CS2 2v2 Tournament Organizer
**Environment:** Physical LAN / Internal Network
**Auth Mode:** Mocked Steam/Discord OAuth
**Notification Mode:** Strategy 3 (Internal Log Interception)

---

## 🏗️ SYSTEM CONFIGURATION (Strategy 3)
To test the Discord flow without a live bot, the IDE must monitor the `discordService.ts` output.
1. **Interceptor:** Divert `executeRealDelivery` to `executeMockDelivery`.
2. **Verification Point:** Ensure the `steam://connect/` string is generated with the correct IP and Password.
3. **Data Link:** Mocked notifications must be readable by the "Marshal View" (Uncle Dave).

---

## 🎭 PERSONA 1: Marcus (The Producer)
**Goal:** Advance the tournament from a desktop environment while live.
1. **Action:** Log in as Admin.
2. **Action:** Create a 2v2 Bracket.
3. **Action:** Assign Team A (Leo/Sam) and Team B (Chloe/Toby) to Match #1.
4. **Action:** Click "Start Match."
5. **Success Criteria:** - OBS Bracket View updates instantly via WebSockets.
   - Internal "Notification Log" triggers 4 distinct entries for the players.
   - The UI shows "Waiting for Players" status.

---

## 🎭 PERSONA 2: Uncle Dave (The Floor Marshal)
**Goal:** Coordinate the physical floor using a mobile device.
1. **Action:** Open `/marshal/dashboard` on a mobile viewport (390x844).
2. **Action:** Locate Match #1.
3. **Success Criteria:** - Dave sees **4 Seat Numbers** (A12, A13, C01, C02) on a single screen.
   - Dave sees the "Mocked Discord Message" for each kid to confirm the system fired.
   - **One-Thumb Test:** Dave can toggle "At Seat" for all 4 players without scrolling.

---

## 🎭 PERSONA 3: Jax & Leo (The Kids)
**Goal:** Join the match with zero technical friction.
1. **Action:** Log in (Mocked Steam Auth).
2. **Action:** Navigate to "My Match."
3. **Action:** Click the "One-Click Join" button (intercepted Steam URI).
4. **Success Criteria:** - The app triggers the `steam://connect/` protocol.
   - **Logic Check:** If `match.password` exists, the URI must be `steam://connect/IP:PORT/PASS`. 
   - If the link fails, the UI must prominently display their **Seat Number** for Dave.

---

## 🧪 TEST SCENARIOS & DISCREPANCY TRIGGERS

### Test 1: The "Empty Password" Bug
- **Scenario:** Create a match with no server password.
- **Discrepancy:** If the Steam URI ends in a trailing slash (e.g., `...:27015/`), flag as **CRITICAL**. It breaks the Steam bootstrapper.

### Test 2: The "Dave Fatigue" Navigation
- **Scenario:** Uncle Dave needs to find the partner of a player.
- **Discrepancy:** If Dave has to click a "View Team" profile to see the second player's seat number, flag as **UX INEFFICIENCY**. 

### Test 3: The "OBS Ghost" Asset
- **Scenario:** Maya (User) uploads a non-transparent team logo mid-match.
- **Discrepancy:** If the OBS View shows a white background box over the stream, flag as **VISUAL DECREPANCY**.

### Test 4: The "Strategy 3" Validation
- **Scenario:** The Discord Bot is offline (Expected).
- **Discrepancy:** If the app throws a `500 Error` because the Discord API is unreachable, flag as **LOGIC FAILURE**. The app must fallback to the Internal Mock Log.

---

## 🚀 IDE EXECUTION COMMAND
"Run E2E suite. Focus on the data hand-off between Marcus's 'Start' trigger and Dave's mobile 'Match Card'. Flag any instance where a Steam ID is shown to Dave instead of a Seat Number."