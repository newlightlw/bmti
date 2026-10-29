import React from "react";
import { createRoot } from "react-dom/client";
import Experience from "../app/experience";
import Admin from "../app/admin/panel";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  window.location.pathname === "/admin" ||
    window.location.pathname === "/admin/" ? (
    <Admin />
  ) : (
    <Experience />
  ),
);
