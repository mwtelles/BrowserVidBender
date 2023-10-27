import Clock from "./deps/clock.js";
import View from "./views.js";
const view = new View();
const clock = new Clock();

let took = "";

view.configureOnFileChange((file) => {
  clock.start((time) => {
    took = time;
    view.updateElapsedTime(`Processo iniciado há ${time}`);
  });

  setTimeout(() => {
    clock.stop();
    view.updateElapsedTime(`O processo levou ${took.replace("atrás", "")}`);
  }, 5000);
});

async function fakeFetch() {
    const filePath = 'videos/frag_bunny.mp4';
    const response = await fetch(filePath);
    const file = new File([await response.blob()], filePath, { type: 'video/mp4', lastModified: Date.now() });
    const event = new Event('change');
    Reflect.defineProperty(event, 'target', { value: { files: [file] } });
    document.getElementById('fileUpload').dispatchEvent(event);
}

fakeFetch();
