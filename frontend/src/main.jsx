import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { ApolloProvider } from "@apollo/client/react";
import "./index.css";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import store from "./redux/store";
import apolloClient from "./services/apolloClient";
import { registerPwa } from "./pwa/registerPwa";

registerPwa();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApolloProvider>
    </Provider>
  </StrictMode>,
);
