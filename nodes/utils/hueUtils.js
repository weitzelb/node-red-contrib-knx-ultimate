'use strict'

// const hueApi = require('node-hue-api')
const hueApiV2 = require('node-hue')
const { EventEmitter } = require('events')
const https = require('https')
const EventSource = require('eventsource');

class classHUE extends EventEmitter {
  constructor(_hueBridgeIP, _username, _clientkey, _bridgeid) {
    super()
    this.setup(_hueBridgeIP, _username, _clientkey, _bridgeid)
  }

  setup = async (_hueBridgeIP, _username, _clientkey, _bridgeid) => {
    this.hueBridgeIP = _hueBridgeIP
    this.username = _username
    this.clientkey = _clientkey
    this.bridgeid = _bridgeid
    this.commandQueue = []
    this.closePushEventStream = false
    this.timerwriteQueueAdd = setTimeout(this.handleQueue, 3000) // First start
    this.connect()

    // this.run()
    // start the SSE Stream Receiver
    // #############################################
    // const options = {
    //   host: _hueBridgeIP, // Indirizzo IP del tuo bridge Philips Hue
    //   path: '/eventstream/clip/v2', // Il percorso dell'API per gli eventi
    //   method: 'GET',
    //   headers: {
    //     'Connection': 'keep-alive',
    //     'hue-application-key': _username
    //     //'Accept': 'text/event-stream'
    //   },
    //   rejectUnauthorized: false
    // }

    // // Funzione per la gestione della risposta
    // const handleResponse = (response) => {
    //   let data = '';

    //   response.on('data', (chunk) => {
    //     data += chunk;
    //   });

    //   response.on('end', () => {
    //     try {
    //       const events = JSON.parse(data)
    //       // An array event "Container", can have multiple events.
    //       // for..loop is more efficent. We need speed.
    //       for (let index = 0; index < events.length; index++) {
    //         const oEvento = events[index]
    //         if (oEvento.type === 'update') {
    //           for (let i = 0; i < oEvento.data.length; i++) {
    //             const element = oEvento.data[i]
    //             this.emit('event', element)
    //           }
    //         }
    //       }
    //     } catch (error) {
    //       console.log('KNXUltimateHUEConfig: classHUE: response.on(end): ' + error.message)
    //     }
    //     req();
    //   });
    // };
    // // Funzione per richiedere gli eventi
    // const req = () => {
    //   if (this.closePushEventStream) return // I'm destroying the class
    //   const request = https.request(options, handleResponse);
    //   request.on('error', (error) => {
    //     console.log('KNXUltimateHUEConfig: classHUE: request.on(error): ' + error.message)
    //     // Restart the connection
    //     setTimeout(() => {
    //       this.commandQueue = []
    //       req();
    //     }, 2000);
    //   });
    //   request.end();
    // };

    // // Starts the connection for the first time
    // req();


    // Eventstream Reader using hueApiV2
    // const runStreamReader = async () => {
    //   try {
    //     const listener = (event) => {
    //       // console.log(event)
    //       event.data.forEach(element => {
    //         if (event.type === 'update') this.emit('event', element)
    //       })
    //     }
    //     const hueEventStream = hueApiV2.connect({
    //       host: this.hueBridgeIP,
    //       key: this.username,
    //       eventListener: listener
    //     })
    //   } catch (error) {
    //     console.log('KNXUltimateHUEConfig: classHUE: const run = async: ' + error.message)
    //   }
    // }
    // runStreamReader()



    // #############################################
  }


  connect() {
    // #############################################
    const options = {
      headers: {
        'hue-application-key': this.username,
      },
      https: {
        rejectUnauthorized: false,
      },
    };

    this.es = new EventSource('https://' + this.hueBridgeIP + '/eventstream/clip/v2', options);

    this.es.onmessage = (event) => {
      try {
        if (event && event.type === 'message' && event.data) {
          const data = JSON.parse(event.data);
          data.forEach(element => {
            if (element.type === 'update') {
              element.data.forEach(ev => {
                this.emit('event', ev)
              })
            }
          })
        }
      } catch (error) {
        console.log('KNXUltimateHUEConfig: classHUE: this.es.onmessage: ' + error.message)
      }

    };

    this.es.onopen = () => {
      //console.log('KNXUltimateHUEConfig: classHUE: SSE-Connected')
      //this.emit('connected');
    }
    this.es.onerror = (error) => {
      try {
        this.es.close()
        this.es = null
        console.log('KNXUltimateHUEConfig: classHUE: request.on(error): ' + error.message)
        setTimeout(() => {
          this.connect()
        }, 5000);
      } catch (error) {

      }
      //this.emit('error', err)
    };
  }
  // #############################################


  // Handle the send queue
  // ######################################
  handleQueue = async () => {
    if (this.commandQueue.length > 0) {
      const jRet = this.commandQueue.shift()
      switch (jRet._operation) {
        case 'setLight':
          try {
            const hue = hueApiV2.connect({ host: this.hueBridgeIP, key: this.username })
            const ok = await hue.setLight(jRet._lightID, jRet._state)
          } catch (error) {
            console.log('KNXUltimateHUEConfig: classHUE: handleQueue: setLight: ' + error.message)
          }
          break
        case 'getLight':
          try {
            const hue = hueApiV2.connect({ host: this.hueBridgeIP, key: this.username })
            const jReturn = await hue.getLight(jRet._lightID)
            jRet._callback(jReturn[0]) // Need to call the callback, because the event is absolutely async
          } catch (error) {
            console.log('KNXUltimateHUEConfig: classHUE: handleQueue: getLight: ' + error.message)
          }
          break
        case 'setScene':
          try {
            const hue = hueApiV2.connect({ host: this.hueBridgeIP, key: this.username })
            const sceneID = jRet._lightID
            const ok = await hue.setScene(sceneID, jRet._state)
          } catch (error) {
            console.log('KNXUltimateHUEConfig: classHUE: handleQueue: setScene: ' + error.message)
          }
          break
        case 'stopScene':
          try {
            const hue = hueApiV2.connect({ host: this.hueBridgeIP, key: this.username })
            const allResources = await hue.getResources()
            const sceneID = jRet._lightID
            const jScene = allResources.find(res => res.id === sceneID) || ''
            const linkedLight = allResources.find(res => res.id === jScene.group.rid).children || ''
            linkedLight.forEach(light => {
              this.writeHueQueueAdd(light.rid, jRet._state, 'setLight')
            });
          } catch (error) {
            console.log('KNXUltimateHUEConfig: classHUE: handleQueue: stopScene: ' + error.message)
          }
          break
        default:
          break
      }
    }
    // The Hue bridge allows about 10 telegram per second, so i need to make a queue manager
    setTimeout(this.handleQueue, 100)
  }

  writeHueQueueAdd = async (_lightID, _state, _operation, _callback) => {
    // Add the new item
    this.commandQueue.push({ _lightID, _state, _operation, _callback })
  }
  // ######################################

  // Get all devices and join it with relative rooms, by adding the room name to the device name
  getResources = async (_rtype, _host, _username) => {
    try {
      // V2
      const hue = hueApiV2.connect({ host: _host, key: _username })
      const retArray = []
      const allResources = await hue.getResources()
      const allRooms = await hue.getRooms()
      const newArray = allResources.filter(x => x.type === _rtype)

      newArray.forEach(jResource => {
        if (_rtype === 'scene') {
          const linkedZone = allResources.find(res => res.id === jResource.group.rid) || ''
          retArray.push({ name: 'Scene: ' + jResource.metadata.name + (linkedZone !== undefined ? ', zone ' + linkedZone.metadata.name : ''), id: jResource.id })
        } else {
          const Room = allRooms.find(room => room.children.find(child => child.rid === jResource.owner.rid))
          const linkedDevName = allResources.find(dev => dev.type === 'device' && dev.services.find(serv => serv.rid === jResource.id)).metadata.name || ''
          if (_rtype === 'button') {
            const controlID = jResource.metadata !== undefined ? (jResource.metadata.control_id || '') : ''
            retArray.push({ name: 'Button: ' + linkedDevName + (controlID !== '' ? ', button ' + controlID : '') + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
          if (_rtype === 'light') {
            retArray.push({ name: 'Light: ' + linkedDevName + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
          if (_rtype === 'motion') {
            retArray.push({ name: 'Motion: ' + linkedDevName + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
          if (_rtype === 'relative_rotary') {
            retArray.push({ name: 'Rotary: ' + linkedDevName + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
          if (_rtype === 'light_level') {
            retArray.push({ name: 'Light Level: ' + linkedDevName + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
          if (_rtype === 'temperature') {
            retArray.push({ name: 'Temperature: ' + linkedDevName + (Room !== undefined ? ', room ' + Room.metadata.name : ''), id: jResource.id })
          }
        }
      })
      return { devices: retArray }
    } catch (error) {
      console.log('KNXUltimateHue: HueUtils: classHUE: getDevices: error ' + error.message)
      return ({ devices: error.message })
    }
  }

  // Get the light details
  getLightStatus = async (_rid) => {
    try {
      const hue = hueApiV2.connect({ host: this.hueBridgeIP, key: this.username })
      const oLight = await hue.getLight(_rid)
      return oLight[0]
    } catch (error) {
    }
  }

  close = async () => {
    return new Promise((resolve, reject) => {
      try {
        this.closePushEventStream = true
        if (this.es !== null) this.es.close();
        this.es = null;
        setTimeout(() => {
          resolve(true)
        }, 500)
      } catch (error) {
        reject(error)
      }
    })
  }
}
module.exports.classHUE = classHUE
