/*const server = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";
export default server; */
/*
const server = "";
export default server; */

// Same-port setup: frontend and backend both on port 8000
// window.location.origin automatically gives correct URL in production
const server = process.env.REACT_APP_SERVER_URL || window.location.origin;
export default server;