// The screen picker page can only ask for its list and send back one choice.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("picker", {
  data: () => ipcRenderer.invoke("picker:data"),
  choose: (id) => ipcRenderer.send("picker:choose", id),
});
