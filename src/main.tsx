import { createRoot } from "react-dom/client";
import Home from "../app/page";
import AdminPage from "../app/admin/page";
import "../app/globals.css";

const params = new URLSearchParams(window.location.search);
const app = params.get("admin") === "1" ? <AdminPage /> : <Home />;

createRoot(document.getElementById("root")!).render(app);
