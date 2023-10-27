import VideoProcessor from "./videoProcessor.js";
import MP4Demuxer from "./mp4Demuxer.js";
import CanvasRenderer from "./canvasRenderer.js";

const qvgaConstraints = {
  video: { width: { exact: 320 }, height: { exact: 240 } },
};

const vgaConstraints = {
  video: { width: { exact: 640 }, height: { exact: 480 } },
};

const hdConstraints = {
  video: { width: { exact: 1280 }, height: { exact: 720 } },
};

const encoderConfig = {
  ...qvgaConstraints,
  codec: "vp09.00.10.08",
  pt: 4,
  hardwareAcceleration: "prefer-software",

  // MP4
  // codec: 'avc1.42002A',
  // pt: 1,
  // hardwareAcceleration: 'prefer-hardware',
  // avc: { format: 'annexb' }

  bitrate: 10e6,
};

const mp4Demuxer = new MP4Demuxer();
const videoProcessor = new VideoProcessor({
  mp4Demuxer,
});

onmessage = async ({ data }) => {
  const renderFrame = CanvasRenderer.getRenderer(data.canvas);
  await videoProcessor.start({
    file: data.file,
    renderFrame,
    encoderConfig,
    sendMessage(message) {
      self.postMessage(message);
    },
  });

  postMessage({
    status: "done",
  });
};
