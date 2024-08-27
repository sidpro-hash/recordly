
        
const video = document.querySelector('video');
const startRecordButton = document.querySelector('#startRecordButton');
const ResumeRecordButton = document.querySelector('#ResumeRecordButton');
const StopRecordButton = document.querySelector('#StopRecordButton');
const videoFormatSelection = document.querySelector('#video-format');
const videoQualitySelection = document.querySelector('#video-quality');
const audioSelection = document.querySelector('#audio');
const Screen1 = document.querySelector('#Screen1');
const Screen2 = document.querySelector('#Screen2');

let desktopStream;
let voiceStream;
let recorder;
let audioOption;
const mimeType = 'video/webm;codecs=vp9';
let buffer = [];


const AUDIO_STETTING = {
  "System": {"system": true, "mic": false},
  "Mic System": {"system": true, "mic": true},
  "Mic": {"system": false, "mic": true},
  "Mute": {"system": false, "mic": false}
}

const selectedSet = [
  {"Mic audio": "Mic", "Mute":"Mute" },
  {"System audio": "System", "Mic + System audio" : "Mic System" ,"Mic audio": "Mic", "Mute":"Mute"}
]

const VIDEO_SETTING = {
  "MP4" : "video/mp4",
  "WEBM" : "video/webm"
}

const CAPTURE = {
  "Screen Only": {"screen": true, "camera": false},
  "Screen + Camera": {"screen": true, "camera": true},
  "Camera Only": {"screen": false, "camera": true}
}

function showImageProcessing(show) {
    const overlay = document.getElementById('overlay');
    overlay.style.display = show ? 'block' : 'none';
}

startRecordButton.addEventListener("click", async () => {

  //videoFormatSelection.options[e.selectedIndex].value;
  //videoQualitySelection.options[e.selectedIndex].value;
  audioOption = AUDIO_STETTING[audioSelection.options[audioSelection.selectedIndex].value];
  captureOption = CAPTURE[getSelectedOption()];

  // Prompt the user to share their screen.
  //stream = await navigator.mediaDevices.getDisplayMedia();
  if(captureOption.screen || audioOption.system){
    desktopStream = await navigator.mediaDevices.getDisplayMedia({ video: captureOption.screen, audio: audioOption.system });
  }
    
  if (audioOption.mic || captureOption.camera) {
    voiceStream = await navigator.mediaDevices.getUserMedia({ video: captureOption.camera, audio: audioOption.mic });
  }

  let track = captureOption.screen ? desktopStream : voiceStream;

  const tracks = [
    ...track.getVideoTracks(), 
    ...mergeAudioStreams(desktopStream, voiceStream)
  ];
  
  
  stream = new MediaStream(tracks);

  stream.getVideoTracks()[0].onended = () => {
    StopRecordButton.click();
  };

  recorder = new MediaRecorder(stream, {mimeType: mimeType});

  recorder.onstop = async () => {  
    showImageProcessing(true);
    // fix blob, support fix webm file larger than 2GB
    const fixBlob = await getSeekableBlob(new Blob([...buffer], { type: mimeType }));
    
     const a = document.createElement('a');
      a.href = URL.createObjectURL(fixBlob);
      a.download = "screen-recording.webm";
      a.click();
      showImageProcessing(false);
 
 
    // to write locally, it is recommended to use fs.createWriteStream to reduce memory usage
    // const fileWriteStream = fs.createWriteStream(inputPath);
    // const blobReadstream = fixBlob.stream();
    // const blobReader = blobReadstream.getReader();

    // while (true) {
    //   let { done, value } = await blobReader.read();
    //   if (done) {
    //     console.log('write done.');
    //     fileWriteStream.close();
    //     break;
    //   }
    //   fileWriteStream.write(value);
    //   value = null;
    // }
    buffer = [];
};

  // Start recording.
  recorder.start();
    
  recorder.addEventListener("dataavailable", async (event) => {
    // Write chunks to the file.
    //await writable.write(event.data);
    buffer.push(event.data);
    if (recorder.state === "inactive") {
      // Close the file when the recording stops.
      //await writable.close();
    }
  });

  // Preview the screen locally.
  video.srcObject = stream;
  video.muted = true;
  Screen1.style.display = 'none';
  Screen2.style.display = 'block';

  //log("Your screen is being shared.");
});


async function getSeekableBlob(inputBlob) {
  // EBML.js copyrights goes to: https://github.com/legokichi/ts-ebml
  if(typeof EBML === 'undefined') {
      throw new Error('Please link: https://www.webrtc- experiment.com/EBML.js');
  }

  var reader = new EBML.Reader();
  var decoder = new EBML.Decoder();
  var tools = EBML.tools;

  const readstream = inputBlob.stream();
  const readerBlob = readstream.getReader();

  while (true) {
    let { done, value } = await readerBlob.read();
    if (done) {
      reader.stop();
      break;
    }
    let elms = decoder.decode(value);
    // As browser upgrade webm meta attributes are gradually added,  
    // so filter unknown type to bypass this issue.
    elms = elms?.filter(elm => elm.type !== 'unknown')
    elms.forEach(elm => {
      reader.read(elm)
    });
    value = null;
  }
  const refinedMetadataBuf = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
  const refinedMetadataBlob = new Blob([refinedMetadataBuf], { type: inputBlob.type });
  const firstPartBlobWithoutMetadata = inputBlob.slice(reader.metadataSize);
  const finalBlob = new Blob([refinedMetadataBlob, firstPartBlobWithoutMetadata], { type: inputBlob.type });
  
  return finalBlob;
}
       


// JavaScript for handling option selection and getting the selected value
document.addEventListener('DOMContentLoaded', () => {
  const options = document.querySelectorAll('.option');

  options.forEach(option => {
      option.addEventListener('click', () => {
          options.forEach(opt => opt.classList.remove('selected')); // Remove 'selected' class from all options
          option.classList.add('selected'); // Add 'selected' class to clicked option
        
          if(getSelectedOption() == "Camera Only")
          {
            audioSelection.length = 0;
            for (let field in selectedSet[0]) {
              audioSelection.options[audioSelection.options.length] = new Option(field, selectedSet[0][field], 
                selectedSet[0][field] == "Mic" ? true : false, selectedSet[0][field] == "Mic" ? true : false);
            }
          } 
          else
          {
            audioSelection.length = 0;
            for (let field in selectedSet[1]) {
              audioSelection.options[audioSelection.options.length] = new Option(field, selectedSet[1][field], 
                selectedSet[1][field] == "System" ? true : false, selectedSet[1][field] == "System" ? true : false);
            }
          }
      });
  });
});

ResumeRecordButton.addEventListener('click', () => {
  try{
    if(ResumeRecordButton.textContent == 'Pause'){
      ResumeRecordButton.textContent = 'Resume';
      recorder.pause();

    }
    else if(ResumeRecordButton.textContent == 'Resume'){
      recorder.resume();
      ResumeRecordButton.textContent = 'Pause';
    }
  }
  catch(e)
  {
    console.log(e);
  }
});

StopRecordButton.addEventListener('click', () => {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    recorder.stop();
    Screen1.style.display = 'block';
    Screen2.style.display = 'none';
});

// Function to get the selected option's text
function getSelectedOption() {
  const selectedOption = document.querySelector('.option.selected');
  return selectedOption ? selectedOption.querySelector('span').textContent.trim() : null;
}

const mergeAudioStreams = (desktopStream, voiceStream) => {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  let hasDesktop = false;
  let hasVoice = false;
  if (audioOption.system && desktopStream && desktopStream.getAudioTracks().length > 0) {
    // If you don't want to share Audio from the desktop it should still work with just the voice.
    const source1 = context.createMediaStreamSource(desktopStream);
    const desktopGain = context.createGain();
    desktopGain.gain.value = 0.7;
    source1.connect(desktopGain).connect(destination);
    hasDesktop = true;
  }
  
  if (audioOption.mic && voiceStream && voiceStream.getAudioTracks().length > 0) {
    const source2 = context.createMediaStreamSource(voiceStream);
    const voiceGain = context.createGain();
    voiceGain.gain.value = 0.7;
    source2.connect(voiceGain).connect(destination);
    hasVoice = true;
  }
    
  return (hasDesktop || hasVoice) ? destination.stream.getAudioTracks() : [];
};