import { useEffect, useRef } from 'react';

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let mouse = { x: -1000, y: -1000 };

    class ArtificialNeuron {
      id: number; layer: number; index: number;
      baseX: number; baseY: number; x: number; y: number;
      vx: number; vy: number; activation: number; size: number;

      constructor(id: number, layer: number, index: number, baseX: number, baseY: number) {
        this.id = id; this.layer = layer; this.index = index;
        this.baseX = baseX; this.baseY = baseY;
        this.x = baseX; this.y = baseY;
        this.vx = 0; this.vy = 0;
        this.activation = Math.random() * 0.15;
        this.size = 3.5 + Math.random() * 2.5;
      }

      update(time: number) {
        const targetX = this.baseX + Math.sin(time * 0.4 + this.id * 1.5) * 12;
        const targetY = this.baseY + Math.cos(time * 0.35 + this.id * 2.2) * 16;
        const springK = 0.08;
        const damping = 0.81;
        this.vx += (targetX - this.x) * springK;
        this.vy += (targetY - this.y) * springK;
        this.vx *= damping;
        this.vy *= damping;
        this.x += this.vx;
        this.y += this.vy;
        if (this.activation > 0.02) {
          this.activation -= 0.008;
        } else {
          this.activation = 0.01 + Math.sin(time * 0.6 + this.id) * 0.015;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        const actGlow = this.activation * 14;
        if (actGlow > 0) {
          c.beginPath();
          c.arc(this.x, this.y, this.size + actGlow + 3, 0, Math.PI * 2);
          const grad = c.createRadialGradient(this.x, this.y, this.size - 1, this.x, this.y, this.size + actGlow + 3);
          grad.addColorStop(0, `rgba(165, 192, 255, ${0.12 + this.activation * 0.22})`);
          grad.addColorStop(1, `rgba(165, 192, 255, 0)`);
          c.fillStyle = grad;
          c.fill();
        }
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = `rgba(147, 197, 253, ${0.14 + this.activation * 0.62})`;
        c.strokeStyle = `rgba(165, 192, 255, ${0.32 + this.activation * 0.48})`;
        c.lineWidth = 1.0;
        c.fill();
        c.stroke();
      }
    }

    class ActivationPulse {
      fromNode: ArtificialNeuron; toNode: ArtificialNeuron;
      progress: number; speed: number;
      constructor(from: ArtificialNeuron, to: ArtificialNeuron) {
        this.fromNode = from; this.toNode = to;
        this.progress = 0; this.speed = 0.015 + Math.random() * 0.012;
      }
      update() { this.progress += this.speed; }
      getPosition() {
        return {
          x: this.fromNode.x + (this.toNode.x - this.fromNode.x) * this.progress,
          y: this.fromNode.y + (this.toNode.y - this.fromNode.y) * this.progress
        };
      }
    }

    const layerDistribution = [3, 4, 4, 4, 3];
    const layerCount = layerDistribution.length;
    let neurons: ArtificialNeuron[] = [];
    let pulses: ActivationPulse[] = [];
    let lastInferenceTime = Date.now();

    const rebuildNetwork = (w: number, h: number) => {
      neurons = []; pulses = [];
      let globalId = 0;
      for (let l = 0; l < layerCount; l++) {
        const nodeCount = layerDistribution[l];
        const x = 70 + (l / (layerCount - 1)) * (w - 140);
        for (let i = 0; i < nodeCount; i++) {
          const y = 90 + (i / (nodeCount - 1 || 1)) * (h - 180);
          neurons.push(new ArtificialNeuron(globalId++, l, i, x, y));
        }
      }
    };

    rebuildNetwork(width, height);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      rebuildNetwork(width, height);
    };
    window.addEventListener('resize', handleResize);

    const triggerForwardCascade = (fromNeuron: ArtificialNeuron) => {
      if (fromNeuron.layer >= layerCount - 1) return;
      const nextLayerNodes = neurons.filter(n => n.layer === fromNeuron.layer + 1);
      if (nextLayerNodes.length === 0) return;
      const targetCount = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...nextLayerNodes].sort(() => 0.5 - Math.random());
      shuffled.slice(0, Math.min(targetCount, shuffled.length)).forEach(target => {
        if (pulses.length < 35) pulses.push(new ActivationPulse(fromNeuron, target));
      });
    };

    const handleClick = (e: MouseEvent) => {
      let closest: ArtificialNeuron | null = null;
      let minDist = Infinity;
      neurons.forEach(n => {
        const dx = n.x - e.clientX;
        const dy = n.y - e.clientY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) { minDist = d; closest = n; }
      });
      if (closest && minDist < 220) {
        closest.activation = 1.0;
        triggerForwardCascade(closest);
      }
    };
    window.addEventListener('click', handleClick);

    const handleMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const handleMouseLeave = () => { mouse.x = -1000; mouse.y = -1000; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, width, height);

      const time = Date.now() * 0.001;

      if (Date.now() - lastInferenceTime > 1400) {
        const inputNodes = neurons.filter(n => n.layer === 0);
        if (inputNodes.length > 0) {
          const ri = inputNodes[Math.floor(Math.random() * inputNodes.length)];
          ri.activation = 1.0;
          triggerForwardCascade(ri);
        }
        lastInferenceTime = Date.now();
      }

      for (let i = 0; i < neurons.length; i++) {
        const n1 = neurons[i];
        if (n1.layer === layerCount - 1) continue;
        neurons.filter(n2 => n2.layer === n1.layer + 1).forEach(n2 => {
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = `rgba(165, 192, 255, ${Math.min(0.18, 0.015 + (n1.activation + n2.activation) * 0.045)})`;
          ctx.lineWidth = 0.55;
          ctx.stroke();
        });
      }

      if (mouse.x > -1000 && mouse.y > -1000) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 4.0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 192, 255, 0.82)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#a5c0ff';
        ctx.fill();
        ctx.shadowBlur = 0;

        neurons.forEach(n => {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(165, 192, 255, ${0.04 * (1 - dist / 180)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            n.activation = Math.min(1.0, n.activation + 0.005);
          }
        });
      }

      for (let pIdx = pulses.length - 1; pIdx >= 0; pIdx--) {
        const pulse = pulses[pIdx];
        pulse.update();
        const pos = pulse.getPosition();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = '#bae6fd';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#bae6fd';
        ctx.fill();
        ctx.shadowBlur = 0;
        if (pulse.progress >= 1.0) {
          pulse.toNode.activation = 1.0;
          triggerForwardCascade(pulse.toNode);
          pulses.splice(pIdx, 1);
        }
      }

      neurons.forEach(n => {
        n.update(time);
        n.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
  );
}
