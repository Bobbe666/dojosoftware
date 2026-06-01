import React, { createContext, useContext } from "react";
import { DatenContext } from "../shared/DatenContext";

export const KursContext = createContext();

export const KursProvider = ({ children }) => {
  const { kurse, loading, ladeAlleDaten } = useContext(DatenContext);

  return (
    <KursContext.Provider value={{ kurse, loading, error: '', ladeKurse: ladeAlleDaten }}>
      {children}
    </KursContext.Provider>
  );
};
