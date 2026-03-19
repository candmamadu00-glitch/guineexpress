const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const recordedVideo = document.getElementById('recordedVideo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const downloadBtn = document.getElementById('downloadBtn');

let mediaRecorder;
let recordedChunks = [];
let screenStream, camStream;
let animationId;
let isCameraVisible = true;

// 🟢 A CORREÇÃO ESTÁ AQUI 🟢
// Precisamos avisar o navegador que estes vídeos devem tocar sempre (autoplay)
// e adicioná-los ao HTML (escondidos) para que ele não os congele para poupar RAM.
const screenVid = document.createElement('video');
screenVid.muted = true;
screenVid.autoplay = true; 
screenVid.playsInline = true;
screenVid.style.display = 'none'; // Fica invisível
document.body.appendChild(screenVid); // Adiciona ao fundo da página

const camVid = document.createElement('video');
camVid.muted = true;
camVid.autoplay = true;
camVid.playsInline = true;
camVid.style.display = 'none'; // Fica invisível
document.body.appendChild(camVid); // Adiciona ao fundo da página

toggleCamBtn.addEventListener('click', () => {
    isCameraVisible = !isCameraVisible;
    if (isCameraVisible) {
        toggleCamBtn.innerHTML = '📷 Ocultar Câmera';
        toggleCamBtn.className = 'btn warning';
    } else {
        toggleCamBtn.innerHTML = '📷 Mostrar Câmera';
        toggleCamBtn.className = 'btn success';
    }
});

startBtn.addEventListener('click', async () => {
    try {
        canvas.style.display = 'block';
        recordedVideo.style.display = 'none';
        recordedVideo.src = ""; 

        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, 
            audio: true 
        });

        camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });

        screenVid.srcObject = screenStream;
        camVid.srcObject = camStream;
        
        await screenVid.play();
        await camVid.play();

        function drawFrame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (screenVid.readyState >= 2) { 
                ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);
            }
            
            if (isCameraVisible && camVid.readyState >= 2) {
                const camWidth = 320;
                const camHeight = 180;
                const padding = 30;
                const camX = canvas.width - camWidth - padding;
                const camY = canvas.height - camHeight - padding;

                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 15;
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#38bdf8';
                ctx.strokeRect(camX, camY, camWidth, camHeight);
                ctx.shadowBlur = 0; 

                ctx.drawImage(camVid, camX, camY, camWidth, camHeight);
            }

            animationId = requestAnimationFrame(drawFrame);
        }
        
        drawFrame();

        const audioCtx = new AudioContext();
        const audioDest = audioCtx.createMediaStreamDestination();

        if (screenStream.getAudioTracks().length > 0) {
            audioCtx.createMediaStreamSource(screenStream).connect(audioDest);
        }
        if (camStream.getAudioTracks().length > 0) {
            audioCtx.createMediaStreamSource(camStream).connect(audioDest);
        }

        const canvasStream = canvas.captureStream(30);
        const finalStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDest.stream.getAudioTracks()
        ]);

        mediaRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm; codecs=vp9' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            canvas.style.display = 'none';
            recordedVideo.style.display = 'block';
            
            recordedVideo.src = url;
            
            downloadBtn.href = url;
            downloadBtn.download = `Gravação_Aba_${Date.now()}.webm`;
            downloadBtn.style.display = 'inline-flex';
            
            recordedChunks = [];
        };

        mediaRecorder.start();
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        toggleCamBtn.disabled = false;
        downloadBtn.style.display = 'none';
        
        isCameraVisible = true;
        toggleCamBtn.innerHTML = '📷 Ocultar Câmera';
        toggleCamBtn.className = 'btn warning';

        screenStream.getVideoTracks()[0].onended = stopRecording;

    } catch (err) {
        console.error("Erro:", err);
        alert("Foi negada alguma permissão ou cancelada a captura.");
    }
});

stopBtn.addEventListener('click', stopRecording);

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    
    cancelAnimationFrame(animationId);

    startBtn.disabled = false;
    stopBtn.disabled = true;
    toggleCamBtn.disabled = true;
}