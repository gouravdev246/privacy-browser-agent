Implement a privacy-preserving "Local Data Resolver" architecture for our Chrome extension.

IMPORTANT:
This is an extension of our existing privacy architecture. Do NOT rewrite NanoBrowser, do NOT replace the existing Privacy Engine, and do NOT bypass existing sanitization or fail-closed behavior.

The goal is to allow the browser agent to perform tasks such as:

- "Fill out this form"
- "Enter my email"
- "Use my saved address"
- "Fill the registration form with my saved information"
- "Submit this application"

while ensuring that the remote/server LLM NEVER receives the user's real personal data.

==================================================
CORE ARCHITECTURE
==================================================

The system must have two logically separated stages:

REMOTE LLM:
Receives ONLY sanitized/abstract browser context and returns an abstract action plan.

LOCAL DATA RESOLVER:
Runs locally inside the extension and has access to the user's locally stored data.

The remote LLM must NEVER receive:
- user's real name
- real email
- real phone number
- address
- passport number
- PAN
- date of birth
- passwords
- payment information
- locally stored profile data
- raw sensitive screenshot content

The local resolver may access these values only locally.

==================================================
DESIRED DATA FLOW
==================================================

USER REQUEST
    ↓
NanoBrowser / Agent
    ↓
Privacy Engine
    ├── DOM sanitization
    ├── Regex detection
    ├── Vision detection
    └── Screenshot redaction
    ↓
SANITIZED PAGE CONTEXT
    ↓
REMOTE LLM
    ↓
ABSTRACT ACTION
    ↓
LOCAL ACTION RESOLVER
    ↓
USER'S LOCAL DATA STORE
    ↓
REAL VALUE RESOLVED LOCALLY
    ↓
Browser action
    ↓
Fill field / click / select / etc.

==================================================
EXAMPLE
==================================================

Suppose the actual page contains:

Name:
Gourav Sarkar

Email:
gourav@example.com

Phone:
9876543210

The remote LLM must NOT see these values.

Instead the Privacy Engine may provide something like:

[0] <label>Full Name</label>
[1] <input name="fullName" value="[NAME_REDACTED]">

[2] <label>Email Address</label>
[3] <input name="email" value="[EMAIL_REDACTED]">

[4] <label>Mobile Number</label>
[5] <input name="phone" value="[PHONE_REDACTED]">

The remote LLM can then produce an abstract action such as:

{
  "action": "fill",
  "fields": [
    {
      "elementIndex": 1,
      "dataKey": "profile.fullName"
    },
    {
      "elementIndex": 3,
      "dataKey": "profile.email"
    },
    {
      "elementIndex": 5,
      "dataKey": "profile.phone"
    }
  ]
}

IMPORTANT:

The remote LLM is NOT allowed to return actual values.

It returns DATA KEYS / INTENTS only.

The local resolver then converts:

profile.fullName
    ↓
"Gourav Sarkar"

profile.email
    ↓
"gourav@example.com"

profile.phone
    ↓
"9876543210"

The actual values are inserted into the browser locally.

==================================================
LOCAL DATA STORAGE
==================================================

Add a local user-data/profile store.

The data must remain inside the user's browser/extension storage.

Possible structure:

{
  profile: {
    fullName: "...",
    email: "...",
    phone: "...",
    dateOfBirth: "...",
    address: "...",
    city: "...",
    state: "...",
    postalCode: "..."
  }
}

Add a clear abstraction around this storage.

For example:

LocalDataStore.get("profile.fullName")

LocalDataStore.get("profile.email")

LocalDataStore.get("profile.phone")

The exact implementation can use the existing extension storage architecture.

Do NOT send this object to the server.

Do NOT include it in:
- LLM prompts
- task history
- telemetry
- console logs
- analytics
- action results sent to the server
- error reports

==================================================
IMPORTANT SECURITY BOUNDARY
==================================================

The remote LLM should only ever know:

"dataKey = profile.email"

It must never know:

"profile.email = gourav@example.com"

The local resolver performs:

dataKey → actual value

locally.

This separation must be explicit in the code.

==================================================
ACTION SCHEMA
==================================================

Create a typed action schema.

Example:

type LocalDataReference = {
  type: "local_data";
  key: string;
};

type FillAction = {
  action: "fill";
  elementIndex: number;
  value: LocalDataReference;
};

The remote LLM can generate:

{
  "action": "fill",
  "elementIndex": 3,
  "value": {
    "type": "local_data",
    "key": "profile.email"
  }
}

It must NOT generate:

{
  "action": "fill",
  "elementIndex": 3,
  "value": "gourav@example.com"
}

If the remote LLM returns a literal sensitive value instead of a local-data reference, reject the action or sanitize it according to the existing fail-closed policy.

==================================================
LOCAL RESOLUTION
==================================================

Before executing a fill action:

1. Validate the action schema.
2. Verify that the data reference is an allowed local key.
3. Retrieve the value from LocalDataStore.
4. Do NOT expose the value to the remote LLM.
5. Pass the resolved value directly to the local browser-action layer.
6. Do not include the resolved value in action results sent back to the remote LLM.

Example:

REMOTE:

{
  action: "fill",
  elementIndex: 3,
  value: {
    type: "local_data",
    key: "profile.email"
  }
}

LOCAL:

const value = await LocalDataStore.get("profile.email");

await browser.fillElement(3, value);

The action result sent back to the LLM should be something like:

"Successfully filled the requested field."

NOT:

"Successfully filled email with gourav@example.com."

==================================================
FORM FIELD MAPPING
==================================================

The remote LLM should identify fields using sanitized information such as:

- label
- field name
- placeholder
- input type
- element index
- semantic field identifier

For example:

<label>Email Address</label>
<input name=email value=[EMAIL_REDACTED]>

The LLM should infer:

dataKey = profile.email

The actual email remains local.

Support common mappings such as:

profile.fullName
profile.email
profile.phone
profile.dateOfBirth
profile.address
profile.city
profile.state
profile.postalCode
profile.country

Keep this mapping extensible.

==================================================
SCREENSHOTS
==================================================

The existing Privacy Engine already sanitizes screenshots.

Preserve that architecture.

The remote LLM may receive ONLY the sanitized screenshot.

Never send the original screenshot when privacy analysis fails.

Never expose the local user's real stored values through screenshots.

Do NOT implement OCR in this task.

Do NOT modify the existing VisionDetector unless absolutely required for integration.

==================================================
FAIL-CLOSED REQUIREMENTS
==================================================

Preserve the existing fail-closed behavior.

If:

- privacy analysis fails
- screenshot sanitization fails
- DOM sanitization fails
- local data resolution fails
- requested data key is invalid
- action schema is invalid
- local storage cannot be accessed

then DO NOT transmit sensitive information.

Never fall back to:

"send the real value to the LLM so it can figure it out."

That is explicitly prohibited.

==================================================
USER DATA MANAGEMENT
==================================================

Add a simple extension UI for the user to manage their local profile data.

The user should be able to enter:

Full Name
Email
Phone
Date of Birth
Address
City
State
Postal Code
Country

Clearly indicate:

"Stored locally in this browser. Never sent to the remote AI."

Do not require a backend database.

Do not sync this information to the server.

Do not add cloud storage for this data.

==================================================
PRIVACY LOGGING
==================================================

Preserve the existing DEV-only privacy debugging.

DO NOT log:

- real profile values
- resolved local values
- raw screenshots
- raw DOM containing PII

It is acceptable to log:

{
  dataKey: "profile.email",
  resolved: true
}

but NEVER:

{
  dataKey: "profile.email",
  value: "gourav@example.com"
}

For screenshot debugging, only log/display the already-sanitized screenshot.

==================================================
IMPORTANT ARCHITECTURAL RULE
==================================================

Do not put the local profile data into the BaseAgent messages.

Do not add it to inputMessages.

Do not put it into task history.

Do not put it into Planner prompts.

Do not put it into Navigator prompts.

Do not put it into server LLM tool responses.

The local data should exist only at the final local action-execution boundary.

==================================================
EXAMPLE END-TO-END
==================================================

User:

"Fill this registration form using my saved information."

PAGE:

Name → [NAME_REDACTED]
Email → [EMAIL_REDACTED]
Phone → [PHONE_REDACTED]

REMOTE LLM:

{
  "actions": [
    {
      "action": "fill",
      "elementIndex": 1,
      "value": {
        "type": "local_data",
        "key": "profile.fullName"
      }
    },
    {
      "action": "fill",
      "elementIndex": 3,
      "value": {
        "type": "local_data",
        "key": "profile.email"
      }
    },
    {
      "action": "fill",
      "elementIndex": 5,
      "value": {
        "type": "local_data",
        "key": "profile.phone"
      }
    }
  ]
}

LOCAL:

profile.fullName → actual value
profile.email → actual value
profile.phone → actual value

Browser:

fill element 1 with actual name
fill element 3 with actual email
fill element 5 with actual phone

REMOTE LLM:

receives only:

"Fields filled successfully."

No actual values are returned.

==================================================
IMPLEMENTATION PROCESS
==================================================

FIRST:

Inspect the existing architecture completely.

Pay particular attention to:

- PrivacyEngine
- VisionDetector
- ImageRedactor
- NanoBrowserAdapter
- BaseAgent
- PlannerAgent
- NavigatorAgent
- browser action execution
- extension storage
- existing message-passing architecture
- current action schemas/types

Do not start modifying files until you understand the existing flow.

SECOND:

Design the smallest clean integration that preserves existing architecture.

THIRD:

Implement the LocalDataStore and typed local-data references.

FOURTH:

Integrate local-data references into the existing action execution pipeline.

FIFTH:

Add a minimal profile-management UI.

SIXTH:

Add tests proving:

1. Real local data is never included in outgoing LLM messages.
2. Remote LLM receives only data keys.
3. Local resolver can retrieve a data key.
4. Resolved data reaches browser action execution.
5. Resolved values are not included in action results.
6. Invalid data keys are rejected.
7. Privacy failures remain fail-closed.
8. Existing DOM privacy tests continue passing.
9. Existing screenshot privacy behavior continues working.
10. Existing NanoBrowser functionality remains intact.

IMPORTANT:
Do not over-engineer this implementation.
Do not rewrite existing systems.
Do not implement OCR.
Do not change the model provider.
Do not change the existing privacy detection algorithms unless necessary.
Do not send real user data to the server as a fallback.

At the end, report:

A. Exact files changed
B. New data flow
C. Security/privacy boundary
D. Local storage architecture
E. Remote LLM action schema
F. Local resolution flow
G. Tests added/passed
H. Remaining limitations

Keep the implementation focused on this feature only.