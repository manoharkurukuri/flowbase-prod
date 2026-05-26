class AssemblyAIPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const processorOptions = options.processorOptions || {};
    this.targetSampleRate = processorOptions.targetSampleRate || 16000;
    this.chunkSize = processorOptions.chunkSize || Math.round(this.targetSampleRate * 0.05);
    this.sourceSampleRate = sampleRate;
    this.sampleRatio = this.sourceSampleRate / this.targetSampleRate;
    this.pending = new Float32Array(0);
    this.pendingOffset = 0;
    this.output = new Int16Array(this.chunkSize);
    this.outputOffset = 0;
  }

  appendInput(input) {
    const next = new Float32Array(this.pending.length + input.length);
    next.set(this.pending);
    next.set(input, this.pending.length);
    this.pending = next;
  }

  emitSample(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    this.output[this.outputOffset] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.outputOffset += 1;

    if (this.outputOffset >= this.output.length) {
      const buffer = this.output.buffer;
      this.port.postMessage(buffer, [buffer]);
      this.output = new Int16Array(this.chunkSize);
      this.outputOffset = 0;
    }
  }

  resamplePending() {
    while (this.pendingOffset + 1 < this.pending.length) {
      const index = Math.floor(this.pendingOffset);
      const fraction = this.pendingOffset - index;
      const sample =
        this.pending[index] + (this.pending[index + 1] - this.pending[index]) * fraction;

      this.emitSample(sample);
      this.pendingOffset += this.sampleRatio;
    }

    const consumed = Math.floor(this.pendingOffset);

    if (consumed > 0) {
      this.pending = this.pending.slice(consumed);
      this.pendingOffset -= consumed;
    }
  }

  process(inputs) {
    const channels = inputs[0];

    if (!channels || channels.length === 0 || channels[0].length === 0) {
      return true;
    }

    const frameCount = channels[0].length;
    let mono = channels[0];

    if (channels.length > 1) {
      mono = new Float32Array(frameCount);

      for (let index = 0; index < frameCount; index += 1) {
        let sum = 0;

        for (let channel = 0; channel < channels.length; channel += 1) {
          sum += channels[channel][index] || 0;
        }

        mono[index] = sum / channels.length;
      }
    }

    this.appendInput(mono);
    this.resamplePending();

    return true;
  }
}

registerProcessor("assemblyai-pcm-processor", AssemblyAIPcmProcessor);
