(function () {
    const DONE = 4;
    const MILLISECONDS_IN_MINUTE = 60 * 1000;
    const MILLISECONDS_IN_HOUR = 60 * MILLISECONDS_IN_MINUTE;
    
    let authToken = null;
    let tthMoment = null;
    let tthDisplay = null;
    let infoDisplay = null;
    let tthContainer = null;

    const qualities = new Map();

    function debug(message) {
        console.debug(`[FL Time Keeper] ${message}`);
    }

    function error(message) {
        console.error(`[FL Time Keeper] ${message}`);
    }

    function tillNextStateUpdate() {
        const now = new Date();

        if (now.getTime() > tthMoment) {
            // TTH can be a little late and TTH endpoint can still display
            // old data past the specified moment. We'll take some time
            // until querying API again.
            return 10 * MILLISECONDS_IN_MINUTE;
        } else if (tthMoment - now.getTime() < MILLISECONDS_IN_HOUR) {
            // When there is a less then one hour left, update the display
            // once per minute.
            return MILLISECONDS_IN_MINUTE;
        }

        const nowMinutes = now.getMinutes();
        const destMinutes = new Date(tthMoment).getMinutes();

        // Since TTH does not arrive on the clear cut hourly boundary,
        // we need first to align our updates with the precise time in minutes.
        if (nowMinutes < destMinutes) {
            return (destMinutes - nowMinutes) * MILLISECONDS_IN_MINUTE;
        } else {
            return ((60 - nowMinutes) + destMinutes) * MILLISECONDS_IN_MINUTE;
        }
    }

    function updateState() {
        const nowMoment = new Date().getTime();

        if (tthMoment == null|| nowMoment >= tthMoment) {
            getTTHMoment()
                .then(moment => {
                    tthMoment = moment;
                    updateState();
                })
                .catch(err => error(err));
            return;
        }

        updateTTHDisplay();
        debug(`Next display update in ${tillNextStateUpdate() / (MILLISECONDS_IN_MINUTE)} minutes.`);
        setTimeout(updateState, tillNextStateUpdate());
    }

    function updateTTHDisplay() {
        if (tthDisplay == null) {
            return;
        }

        const now = new Date().getTime();

        const minutesLeft = Math.round((tthMoment - now) / (MILLISECONDS_IN_MINUTE));
        const hoursLeft = Math.floor(minutesLeft / 60);
        const daysLeft = Math.ceil(hoursLeft / 24);

        let remainingText;

        debug(`Time till TTH comes: ${daysLeft} days or ${hoursLeft} hours or ${minutesLeft} minutes.`)

        if (daysLeft > 0) {
            remainingText = `in ${daysLeft} days.`;
        } else if (hoursLeft > 0) {
            remainingText = `in ${hoursLeft} hours.`
        } else if (minutesLeft > 0) {
            remainingText = `in ${minutesLeft} minutes.`
        } else {
            remainingText = `again someday.`
        }

        tthDisplay.textContent = `Time the Healer cometh ${remainingText}`;

        const currentMakingWaves = qualities.get("Making Waves") || 0;
        const currentNotability = qualities.get("Notability") || 0;
        if (currentMakingWaves < currentNotability) {
            infoDisplay.textContent = `You will lose Notability! (${currentMakingWaves} MW < ${currentNotability} Nota)`;
            infoDisplay.style.display = "block";
        } else {
            infoDisplay.style.display = "hidden";
        }

    }

    function insertTTHDisplay(cardsDiv) {
        const containerDiv = document.createElement("div");
        containerDiv.classList.add("media", "storylet");

        const displayDiv = document.createElement("div");
        displayDiv.className = "storylet__body";

        const contentsDiv = document.createElement("div");
        contentsDiv.className = "storylet__title-and-description";

        const title = document.createElement("h2");
        title.setAttribute("id", "tth_display");
        title.classList.add("media__heading", "heading", "heading--3", "storylet__heading");
        title.style.cssText = "text-align: center;";
        title.textContent = "Time the Healer cometh.";
        contentsDiv.appendChild(title);

        const info = document.createElement("h2");
        info.setAttribute("id", "tth_info_display");
        info.classList.add("media__heading", "heading", "heading--3", "storylet__heading");
        info.style.cssText = "text-align: center; display: hidden;";
        info.textContent = "";
        contentsDiv.appendChild(info);

        infoDisplay = info;
        tthDisplay = title;
        tthContainer = containerDiv;

        displayDiv.appendChild(contentsDiv);
        containerDiv.appendChild(displayDiv);

        cardsDiv.parentNode.insertBefore(containerDiv, cardsDiv.nextSibling);
    }

    async function getTTHMoment() {
        debug("Trying to fetch TTH arrival moment from server...");
        const response = await fetch(
            "https://api.fallenlondon.com/api/settings/timethehealer",
            {
                headers: {
                    "Authorization": authToken,
                },
            }
        );
        if (!response.ok) {
            throw new Error("FL API did not like our request");
        }

        const userData = await response.json();
        if (!userData.isSuccess) {
            throw new Error("Could not retrieve Time The Healer moment")
        }

        const stringifiedTime = userData.dateTimeToExecute;
        return Date.parse(stringifiedTime);
    }

    function installAuthSniffer(original_function) {
        return function (name, value) {
            if (name === "Authorization" && value !== authToken) {
                authToken = value;
                debug("Got FL auth token!");

                updateState();
            }
            return original_function.apply(this, arguments);
        }
    }

    function parseResponse(response) {
        if (this.readyState !== DONE) {
            return;
        }

        let targetUrl = response.currentTarget.responseURL;

        if (!targetUrl.includes("fallenlondon")) {
            return;
        }

        if (!((targetUrl.includes("/api/map")
            || targetUrl.includes("/storylet")
            || targetUrl.includes("/choosebranch")
            || targetUrl.includes("/api/character/actions")
            || targetUrl.includes("/myself")))) {
            return;
        }

        let data = JSON.parse(response.target.responseText);

        if (targetUrl.endsWith("/api/storylet/choosebranch")) {
            if ("messages" in data) {
                // NB: For some inexplicable reason gaining something is marked as "decrease" *sigh*
                for (const change of data.messages) {
                    if (change["type"] !== "StandardQualityChangeMessage"
                        && change["type"] !== "PyramidQualityChangeMessage") {
                        continue;
                    }

                    if (change.possession.nature !== "Status") {
                        continue;
                    }

                    const currentLevel = qualities.get(change.possession.name) || 0;
                    if (currentLevel !== change.possession.level) {
                        console.debug(`${change.possession.name}: ${currentLevel} -> ${change.possession.level}`);
                        qualities.set(change.possession.name, change.possession.level);
                    }
                }

            }
        }

        if (response.currentTarget.responseURL.includes("/api/character/myself")) {
            for (const group of data.possessions) {
                for (const quality of group.possessions) {
                    if (quality.nature !== "Status") {
                        continue;
                    }

                    qualities.set(quality.name, quality.level);
                }
            }
        }
    }

    function openBypass(original_function) {
        return function (method, url, async) {
            this._targetUrl = url;
            this.addEventListener("readystatechange", parseResponse);
            return original_function.apply(this, arguments);
        };
    }

    debug("Setting up API interceptors.");
    XMLHttpRequest.prototype.setRequestHeader = installAuthSniffer(XMLHttpRequest.prototype.setRequestHeader);
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);

    debug("Setting up DOM mutation observer.")
    let mainContentObserver = new MutationObserver(((mutations, observer) => {
        for (let m = 0; m < mutations.length; m++) {
            const mutation = mutations[m];

            for (let n = 0; n < mutation.addedNodes.length && tthContainer == null; n++) {
                const node = mutation.addedNodes[n];

                if (node.nodeName.toLowerCase() !== "div") {
                    continue;
                }

                let insertionPoint = null;

                if (node.classList.contains("cards")) {
                    insertionPoint = node;
                } else {
                    const containers = node.getElementsByClassName("cards")
                    if (containers.length !== 0) {
                        insertionPoint = containers[0];
                    }
                }

                if (insertionPoint != null) {
                    insertTTHDisplay(insertionPoint);
                    updateState();
                    break;
                }
            }

            for (let n = 0; n < mutation.removedNodes.length && tthContainer != null; n++) {
                const node = mutation.removedNodes[n];

                if (node.nodeName.toLowerCase() !== "div") {
                    continue;
                }

                const containers = node.getElementsByClassName("cards")
                if (containers.length !== 0 || node.classList.contains("cards")) {
                    tthContainer.remove();
                    tthContainer = tthDisplay = infoDisplay = null;
                    break;
                }
            }
        }
    }));
    mainContentObserver.observe(document, {childList: true, subtree: true});
}())
