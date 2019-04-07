require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

Dehumidifier = function(platform, config) {
    this.init(platform, config);

    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;

    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });

    this.accessories = {};
    if(!this.config['dehumidifierDisable'] && this.config['dehumidifierName'] && this.config['dehumidifierName'] != "" && this.config['silentModeSwitchName'] && this.config['silentModeSwitchName'] != "") {
        this.accessories['dehumidifierAccessory'] = new MiDehumidifierAccessory(this);
    }
    if(!this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new MiDehumidifierHumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new MiDehumidifierBuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new MiDehumidifierLEDBulbAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);

    this.platform.log.debug("[MiDehumidifierPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);

    return accessoriesArr;
}
inherits(MiDehumidifier, Base);

MiDehumidifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['dehumidifierName'];
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
}

MiDehumidifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "New Widetech")
        .setCharacteristic(Characteristic.Model, "MiDehumidifier")
        .setCharacteristic(Characteristic.SerialNumber, "106460515");
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName);
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(!this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }

    var dehumidifierService = new Service.Dehumidifier(this.name);
    var activeCharacteristic = dehumidifierService.getCharacteristic(Characteristic.Active);
    var currentDehumidifierStateCharacteristic = dehumidifierService.getCharacteristic(Characteristic.CurrentDehumidifierState);
    var targetDehumidifierStateCharacteristic = dehumidifierService.getCharacteristic(Characteristic.TargetDehumidifierState);
    var lockPhysicalControlsCharacteristic = dehumidifierService.addCharacteristic(Characteristic.LockPhysicalControls);
    var rotationSpeedCharacteristic = dehumidifierService.addCharacteristic(Characteristic.RotationSpeed);

	var currentRelativeHumidityCharacteristic = dehumidifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    services.push(dehumidifierService);

    silentModeOnCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - SilentModeSwitch - getOn: " + result);

                if(result[0] === "silent") {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - SilentModeSwitch - getOn Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - SilentModeSwitch - setOn: " + value);
            if(value) {
                that.device.call("set_mode", ["silent"]).then(result => {
                    that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - SilentModeSwitch - setOn Result: " + result);
                    if(result[0] === "ok") {
                        targetDehumidifierStateCharacteristic.updateValue(Characteristic.TargetDehumidifierState.AUTO);
                        callback(null);

                        if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                            activeCharacteristic.updateValue(Characteristic.Active.ACTIVE);
                            currentDehumidifierStateCharacteristic.updateValue(Characteristic.CurrentDehumidifierState.PURIFYING_AIR);
                        }
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - SilentModeSwitch - setOn Error: " + err);
                    callback(err);
                });
            } else {
                if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                    callback(null);
                } else {
                    that.device.call("set_mode", [Characteristic.TargetDehumidifierState.AUTO == targetDehumidifierStateCharacteristic.value ? "auto" : "favorite"]).then(result => {
                        that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - SilentModeSwitch - setOn Result: " + result);
                        if(result[0] === "ok") {
                            callback(null);
                        } else {
                            callback(new Error(result[0]));
                        }
                    }).catch(function(err) {
                        that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - SilentModeSwitch - setOn Error: " + err);
                        callback(err);
                    });
                }
            }
        }.bind(this));

    activeCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - Active - getActive: " + result);

                if(result[0] === "idle") {
                    callback(null, Characteristic.Active.INACTIVE);
                } else {
                    callback(null, Characteristic.Active.ACTIVE);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - Active - getActive Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - Active - setActive: " + value);
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - Active - setActive Result: " + result);
                if(result[0] === "ok") {
                    currentDehumidifierStateCharacteristic.updateValue(Characteristic.CurrentDehumidifierState.IDLE);
                    callback(null);
                    if(value) {
                        currentDehumidifierStateCharacteristic.updateValue(Characteristic.CurrentDehumidifierState.PURIFYING_AIR);
                        that.device.call("get_prop", ["mode"]).then(result => {
                            if(result[0] === "silent") {
                                silentModeOnCharacteristic.updateValue(true);
                            } else {
                                silentModeOnCharacteristic.updateValue(false);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - Active - setActive Error: " + err);
                            callback(err);
                        });
                    } else {
                        currentDehumidifierStateCharacteristic.updateValue(Characteristic.CurrentDehumidifierState.INACTIVE);
                        silentModeOnCharacteristic.updateValue(false);
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - Active - setActive Error: " + err);
                callback(err);
            });
        }.bind(this));

    currentDehumidifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - CurrentDehumidifierState - getCurrentDehumidifierState: " + result);

                if(result[0] === "idle") {
                    callback(null, Characteristic.CurrentDehumidifierState.INACTIVE);
                } else {
                    callback(null, Characteristic.CurrentDehumidifierState.PURIFYING_AIR);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - CurrentDehumidifierState - getCurrentDehumidifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    lockPhysicalControlsCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["child_lock"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - LockPhysicalControls - getLockPhysicalControls: " + result);
                callback(null, result[0] === "on" ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - LockPhysicalControls - getLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_child_lock", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - LockPhysicalControls - setLockPhysicalControls Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - LockPhysicalControls - setLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this));

    targetDehumidifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - TargetDehumidifierState - getTargetDehumidifierState: " + result);

                if(result[0] === "favorite") {
                    callback(null, Characteristic.TargetDehumidifierState.MANUAL);
                } else {
                    callback(null, Characteristic.TargetDehumidifierState.AUTO);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - TargetDehumidifierState - getTargetDehumidifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - TargetDehumidifierState - setTargetDehumidifierState: " + value);
            that.device.call("set_mode", [Characteristic.TargetDehumidifierState.AUTO == value ? (silentModeOnCharacteristic.value ? "silent" : "auto") : "favorite"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - TargetDehumidifierState - setTargetDehumidifierState Result: " + result);
                if(result[0] === "ok") {
                    if(Characteristic.TargetDehumidifierState.AUTO == value) {
                        callback(null);
                    } else {
                        that.device.call("get_prop", ["favorite_level"]).then(result => {
                            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - TargetDehumidifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            if(rotationSpeedCharacteristic.value <= result[0] * 10 && rotationSpeedCharacteristic.value > (result[0] - 1) * 10) {
                                callback(null);
                            } else {
                                rotationSpeedCharacteristic.value = result[0] * 10;
                                callback(null);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - TargetDehumidifierState - getRotationSpeed: " + err);
                            callback(err);
                        });
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - TargetDehumidifierState - setTargetDehumidifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    rotationSpeedCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["favorite_level"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - RotationSpeed - getRotationSpeed: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - RotationSpeed - getRotationSpeed Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - RotationSpeed - setRotationSpeed set: " + value);
            if(value == 0) {
                callback(null);
            } else {
                that.device.call("set_level_favorite", [parseInt(value / 10) < 10 ? parseInt(value / 10) + 1 : 10]).then(result => {
                    that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - RotationSpeed - setRotationSpeed Result: " + result);
                    if(result[0] === "ok") {
//                        that.device.call("set_mode", ["favorite"]).then(result => {
//                            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - RotationSpeed - setTargetDehumidifierState Result: " + result);
//                            if(result[0] === "ok") {
//                                targetDehumidifierStateCharacteristic.updateValue(Characteristic.TargetDehumidifierState.MANUAL);
//                                silentModeOnCharacteristic.updateValue(false);
                                  callback(null);
//                            } else {
//                                callback(new Error(result[0]));
//                            }
//                        }).catch(function(err) {
//                            that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - RotationSpeed - setTargetDehumidifierState Error: " + err);
//                            callback(err);
//                        });
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - TargetDehumidifierState - getRotationSpeed: " + err);
                    callback(err);
                })
            }
        }.bind(this));


    currentRelativeHumidityCharacteristic
	    .on('get', function(callback) {
			this.device.call("get_prop", ["humidity"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - Humidity - getHumidity: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - Humidity - getHumidity Error: " + err);
                callback(err);
            });
	    }.bind(this));

    // var filterMaintenanceService = new Service.FilterMaintenance(this.name);
    var filterChangeIndicationCharacteristic = dehumidifierService.getCharacteristic(Characteristic.FilterChangeIndication);
    var filterLifeLevelCharacteristic = dehumidifierService.addCharacteristic(Characteristic.FilterLifeLevel);

    filterChangeIndicationCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - FilterChangeIndication - getFilterChangeIndication: " + result);
                callback(null, result[0] < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - FilterChangeIndication - getFilterChangeIndication Error: " + err);
                callback(err);
            });
        }.bind(this));
    filterLifeLevelCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAccessory - FilterLifeLevel - getFilterLifeLevel: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAccessory - FilterLifeLevel - getFilterLifeLevel Error: " + err);
                callback(err);
            });
        }.bind(this));
    // services.push(filterMaintenanceService);

    return services;
}

MiDehumidifierHumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
}

MiDehumidifierHumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "New Widetech")
        .setCharacteristic(Characteristic.Model, "MiDehumidifier")
        .setCharacteristic(Characteristic.SerialNumber, "106460515");
    services.push(infoService);

    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

MiDehumidifierHumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    this.device.call("get_prop", ["humidity"]).then(result => {
        that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierHumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierHumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}

MiDehumidifierBuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
}

MiDehumidifierBuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "New Widetech")
        .setCharacteristic(Characteristic.Model, "MiDehumidifier")
        .setCharacteristic(Characteristic.SerialNumber, "106460515");
    services.push(infoService);

    var switchService = new Service.Switch(this.name);
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getBuzzerState.bind(this))
        .on('set', this.setBuzzerState.bind(this));
    services.push(switchService);

    return services;
}

MiDehumidifierBuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    this.device.call("get_prop", ["buzzer"]).then(result => {
        that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierBuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState: " + result);
        callback(null, result[0] === "on" ? 1 : 0);
    }).catch(function(err) {
        that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierBuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState Error: " + err);
        callback(err);
    });
}

MiDehumidifierBuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.device.call("set_buzzer", [value ? "on" : "off"]).then(result => {
        that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierBuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierBuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Error: " + err);
        callback(err);
    });
}

MiDehumidifierLEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
}

MiDehumidifierLEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "New Widetech")
        .setCharacteristic(Characteristic.Model, "MiDehumidifier")
        .setCharacteristic(Characteristic.SerialNumber, "106460515");
    services.push(infoService);

    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    var brightnessCharacteristic = switchLEDService.addCharacteristic(Characteristic.Brightness);

    onCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led_b"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierLEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, result[0] === 2 ? false : true);
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierLEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierLEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            that.setLedB(value ? that.getLevelByBrightness(brightnessCharacteristic.value) : 2, callback);
        }.bind(this));
    brightnessCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led_b"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierLEDBulbAccessory - switchLED - getLEDPower: " + result);
                if(result[0] == 0) {
                    if(brightnessCharacteristic.value > 50 && brightnessCharacteristic.value <= 100) {
                        callback(null, brightnessCharacteristic.value);
                    } else {
                        callback(null, 100);
                    }
                } else if(result[0] == 1) {
                    if(brightnessCharacteristic.value > 0 && brightnessCharacteristic.value <= 50) {
                        callback(null, brightnessCharacteristic.value);
                    } else {
                        callback(null, 50);
                    }
                } else if(result[0] == 2) {
                    callback(null, 0);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierLEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(switchLEDService);

    return services;
}

MiDehumidifierLEDBulbAccessory.prototype.setLedB = function(led_b, callback) {
    var that = this;
    that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierLEDBulbAccessory - switchLED - setLedB: " + led_b);
    this.device.call("set_led_b", [led_b]).then(result => {
        that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierLEDBulbAccessory - switchLED - setLEDBrightness Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierLEDBulbAccessory - switchLED - setLEDBrightness Error: " + err);
        callback(err);
    });
}

MiDehumidifierLEDBulbAccessory.prototype.getLevelByBrightness = function(brightness) {
    if(brightness == 0) {
        return 2;
    } else if(brightness > 0 && brightness <= 50) {
        return 1;
    } else if (brightness > 50 && brightness <= 100) {
        return 0;
    }
}

MiDehumidifierAirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "New Widetech")
        .setCharacteristic(Characteristic.Model, "MiDehumidifier")
        .setCharacteristic(Characteristic.SerialNumber, "106460515");
    services.push(infoService);

    var pmService = new Service.AirQualitySensor(this.name);
    var pm2_5Characteristic = pmService.addCharacteristic(Characteristic.PM2_5Density);
    pmService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', function(callback) {
            that.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[MiDehumidifierPlatform][DEBUG]MiDehumidifierAirQualityAccessory - AirQuality - getAirQuality: " + result);

                pm2_5Characteristic.updateValue(result[0]);

                if(result[0] <= 50) {
                    callback(null, Characteristic.AirQuality.EXCELLENT);
                } else if(result[0] > 50 && result[0] <= 100) {
                    callback(null, Characteristic.AirQuality.GOOD);
                } else if(result[0] > 100 && result[0] <= 200) {
                    callback(null, Characteristic.AirQuality.FAIR);
                } else if(result[0] > 200 && result[0] <= 300) {
                    callback(null, Characteristic.AirQuality.INFERIOR);
                } else if(result[0] > 300) {
                    callback(null, Characteristic.AirQuality.POOR);
                } else {
                    callback(null, Characteristic.AirQuality.UNKNOWN);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiDehumidifierPlatform][ERROR]MiDehumidifierAirQualityAccessory - AirQuality - getAirQuality Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(pmService);

    return services;
}
