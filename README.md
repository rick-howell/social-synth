# Social Synth

The interface associated with this project enables users to experiment with synthesizer settings, taking turns in remote collaboration with up to three other people.

This readme walks you through the structure of the project, and where files that constitue the client (what the user experiences as the interface) and server (responsible for maintaining/routing information for/between users) are located.

The client files are located in the `views` and `public` folders.

- When someone navigates to the interface, `views/index.html` is what gets shown to them, so take a brief look through that. It contains a `<head>` tag where libraries (dependencies) are loaded, and a `<body>` tag where the contents of elements of the page are specified.
- The main dependency to know about for this project is `public/client.js`. Browse through the sections of the `make_interface()` function there: Variable declarations; Tone.js setup; p5.js built-ins; server hooks, utilities, and classes.

The main server material is in `server.js` and `game_state.js`.

- The application starts at `server.js`.
- When a user does something with the interface, news of that action arrives here via `fetch()` and `socket.on()` commands written in `public/client.js`, and the various `fastify.post()` and `fastify.io.on()` commands in `server.js` receive and handle the actions appropriately.
- We make use of a library called [Socket.IO](https://socket.io/), which enables users to join different "rooms" of an application and receive near-instant updates from other users in the same room.
- `game_state.js` is worth a read, because it contains a JavaScript class with which new games and new players are spawned in `server.js`.


No need to read/edit these here, but FYI:
- Frameworks and packages are managed in `package.json`;
- Safely store app secrets in `.env` (nobody can see this but you and people you invite).

Click the project name ("social-synth") in the header and select Remix Project to make your own independent copy.

Click `Show` in the header to see your app live. Updates to your code will deploy instantly.


## Originally made by Tom Collins, modified by Rick Howell
