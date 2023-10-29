export default class VideoProcessor {
  #mp4Demuxer;
  #webMWriter;
  #buffers = []
  /**
   *
   * @param {Object} options
   * @param {import('./mp4Demuxer.js').default} options.mp4Demuxer
   * @param {import('./../deps/webm-writer2.js').default} options.WebMWriter
   */

  constructor({ mp4Demuxer, WebMWriter }) {
    this.#mp4Demuxer = mp4Demuxer;
    this.#webMWriter = WebMWriter;
  }
  /** @returns {ReadableStream} */
  mp4Decoder(stream) {
    return new ReadableStream({
      start: async (controller) => {
        const decoder = new VideoDecoder({
          /** @param {VideoFrame} frame **/
          output: (frame) => {
            controller.enqueue(frame);
          },
          error: (error) => {
            console.error("error no mp4 decoder", error);
            controller.error(error);
          },
        });

        return this.#mp4Demuxer
          .run(stream, {
            async onConfig(config) {
              const { supported } = await VideoDecoder.isConfigSupported(
                config
              );
              if (!supported) {
                console.error("MP4 config not supported", config);
                controller.close();
                return;
              }
              decoder.configure(config);
            },
            /** @param {EncodedVideoChunk} chunk **/
            onChunk: (chunk) => {
              decoder.decode(chunk);
            },
          })
      },
    });
  }

  encode144p(encoderConfig) {
    let _encoder;
    const readable = new ReadableStream({
      start: async (controller) => {
        const { supported } = await VideoEncoder.isConfigSupported(
          encoderConfig
        );
        if (!supported) {
          const message = "encode144p VideoEncoder config not supported";
          console.error(message, encoderConfig);
          controller.error(message);
          return;
        }

        _encoder = new VideoEncoder({
          /**
           *
           * @param {EncodedVideoChunk} frame
           * @param {EncodedVideoChunkMetadata} config
           */
          output: (frame, config) => {
            if (config.decoderConfig) {
              const decoderConfig = {
                type: "config",
                config: config.decoderConfig,
              };
              controller.enqueue(decoderConfig);
            }
            controller.enqueue(frame);
          },
          error: (err) => {
            console.error("error no mp4 encoder", err);
            controller.error(err);
          },
        });

        await _encoder.configure(encoderConfig);
      },
    });

    const writable = new WritableStream({
      async write(frame) {
        _encoder.encode(frame);
        frame.close();
      },
    });

    return {
      readable,
      writable,
    };
  }

  renderDecodedFramesAndGetEncodedChunks(renderFrame) {
    let _decoder;
    return new TransformStream({
      start: (controller) => {
        _decoder = new VideoDecoder({
          output: (frame) => {
            renderFrame(frame)
          },
          error: (err) => {
            console.error("error no mp4 decoder", err);
            controller.error(err);
          },
        });
      },
      /**
       *
       * @param {EncodedVideoChunk} encodedChunk
       * @param {TransformStreamDefaultController} controller
       */
      async transform(encodedChunk, controller) {
        if (encodedChunk.type === "config") {
          await _decoder.configure(encodedChunk.config);
          return;
        }
        _decoder.decode(encodedChunk);

        controller.enqueue(encodedChunk);
      },
    });
  }

  transformIntoWebM() {

    const writable = new WritableStream({
      write: (chunk) => {
        this.#webMWriter.addFrame(chunk);
      },
      close() {
        debugger;
      }
    });

    return {
      readable: this.#webMWriter.getStream(),
      writable,
    }
  }

  async start({ file, encoderConfig, renderFrame, sendMessage }) {
    const stream = file.stream();
    const fileName = file.name.split("/").pop().replace(".mp4", "");
    await this.mp4Decoder(stream)
      .pipeThrough(this.encode144p(encoderConfig))
      .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
      .pipeThrough(this.transformIntoWebM())
      .pipeThrough(
        new TransformStream({
          transform: ({ data, position }, controller) => {
            this.#buffers.push(data);
            controller.enqueue(data);
          },
          flush: () => {
            // debugger
            sendMessage({
              status: 'done', 
              // buffers: this.#buffers,
              // filename: fileName.concat('-144p.webm')
            })
          }
        })
      )
      .pipeTo(
        new WritableStream({
          write(frame) {
            // renderFrame(frame);
          },
        })
      );
  }
}
