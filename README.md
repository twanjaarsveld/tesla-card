# Tesla Card for Home Assistant

A sleek, custom card designed for the Tesla Fleet API. This card provides a professional interface to monitor and control your Tesla directly from your dashboard.

<img width="862" height="963" alt="Screenshot 2026-02-23 195118" src="https://github.com/user-attachments/assets/cb5f79d3-4f6a-4401-9d63-1ab9944ad6df" />


## Features
* Vehicle Controls: Toggle car conditioning (AC), lock or unlock the doors, and start or stop charging.
* Live Status: Real-time display of battery percentage, remaining range, and odometer.
* Climate Monitoring: Shows the current inside temperature of the vehicle.
* Dynamic Visuals: Central image updates automatically based on the car's state (charging, heating, cooling, or off).

---

## Installation

### 1. File Placement
Place the files in your Home Assistant www folder (the /local/ path).

* Path: /config/www/community/tesla-car-card/
  * Place tesla-car-card.js in this folder.
  * Create a folder named "images" inside this folder.
  * Place your images inside that folder: /local/community/tesla-car-card/images/

### 2. Add Resource
Add the card reference to your Home Assistant Dashboard:
1. Go to Settings > Dashboards.
2. Click the three dots (top right) and select Resources.
3. Click Add Resource.
4. URL: /local/community/tesla-car-card/tesla-car-card.js
5. Resource Type: JavaScript Module

---

## Privacy and Prefix Configuration
To protect your privacy and keep sensitive data like license plates or VINs out of your configuration, this card uses a prefix system.

### How to find your Prefix
The prefix is the unique identifier Home Assistant uses for your vehicle entities.
1. Go to Settings > Devices and Services > Tesla.
2. Click on Entities.
3. Look for your Battery Level sensor (example: sensor.mycar_battery_level).
4. The prefix is the text between "sensor." and the next underscore.
   * Example: If your entity is sensor.abc_123_battery_level, your prefix is: abc_123

### Dashboard Setup
Add a Custom Manual Card to your dashboard and enter the following YAML:

```yaml
type: custom:tesla-car-card
prefix: [YOUR_PREFIX_HERE]
