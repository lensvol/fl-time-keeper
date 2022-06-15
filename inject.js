(function () {
    const DONE = 4;
    const MILLISECONDS_IN_MINUTE = 60 * 1000;
    const MILLISECONDS_IN_HOUR = 60 * MILLISECONDS_IN_MINUTE;
    const SEVEN_DAYS_IN_MILLISECONDS = 7 * 24 * MILLISECONDS_IN_HOUR;
    // Sometimes "living story" events do not trigger strictly on the hour,
    // so it is good to give them some leeway.
    const EVENT_TRIGGER_LEEWAY = 10 * MILLISECONDS_IN_MINUTE;
    const BALMORAL_GIFT_BRANCH_IDS = [243583, 243592, 243600];
    const KHANATE_REPORT_BRANCH_IDS = [250681];
    const WELLSPRING_BRANCH_IDS = [244785, 244786]
    const WASWOOD_CALENDAR_BRANCH_IDS = [254769, 254764, 254597, 254763, 254765, 254599, 254598, 254767, 254768, 234347, 254844, 254842, 234348, 254510, 254511, 224801, 254843]

    let authToken = null;
    let currentUserId = null;

    let infoDisplay = null;
    let tthContainer = null;

    let tthMoment = null;
    let balmoralMoment = null;
    let khanateMoment = null;
    let wellspringMoment = null;
    let calendarMoment = null

    const qualities = new Map();

    function saveTrackedMoments() {
        if (balmoralMoment != null) {
            let balmoralRecord = localStorage.fl_tk_balmoral_moment || {};
            try {
                balmoralRecord = JSON.parse(balmoralRecord);
                if (typeof balmoralRecord !== "object") {
                    balmoralRecord = {};
                }
            } catch (e) {
                balmoralRecord = {};
            }
            balmoralRecord[`uid_${currentUserId}`] = balmoralMoment;
            localStorage.fl_tk_balmoral_moment = JSON.stringify(balmoralRecord);
        }

        if (khanateMoment != null) {
            let khanateRecord = localStorage.fl_tk_khanate_moment || {};
            try {
                khanateRecord = JSON.parse(khanateRecord);
                if (typeof khanateRecord !== "object") {
                    khanateRecord = {};
                }
            } catch (e) {
                khanateRecord = {};
            }
            khanateRecord[`uid_${currentUserId}`] = khanateMoment;
            localStorage.fl_tk_khanate_moment = JSON.stringify(khanateRecord);
        }
        
        if (wellspringMoment != null) {
            let wellspringRecord = localStorage.fl_tk_wellspring_moment || {};
            try {
                wellspringRecord = JSON.parse(wellspringRecord);
                if (typeof wellspringRecord !== "object") {
                    wellspringRecord = {};
                }
            } catch (e) {
                wellspringRecord = {};
            }
            wellspringRecord[`uid_${currentUserId}`] = wellspringMoment;
            localStorage.fl_tk_wellspring_moment = JSON.stringify(wellspringRecord);
        }
        
        if (calendarMoment != null) {
            let calendarRecord = localStorage.fl_tk_calendar_moment || {};
            try {
                calendarRecord = JSON.parse(calendarRecord);
                if (typeof calendarRecord !== "object") {
                    calendarRecord = {};
                }
            } catch (e) {
                calendarRecord = {};
            }
            calendarRecord[`uid_${currentUserId}`] = calendarMoment;
            localStorage.fl_tk_calendar_moment = JSON.stringify(calendarRecord);
        }
    }

    function loadTrackedMoments() {
        const balmoralRecord = localStorage.fl_tk_balmoral_moment || null;
        try {
            const decoded = JSON.parse(balmoralRecord);
            balmoralMoment = decoded[`uid_${currentUserId}`] || null;
        } catch (e) {
            balmoralMoment = null;
        }

        const khanateRecord = localStorage.fl_tk_khanate_moment || null;
        try {
            const decoded = JSON.parse(khanateRecord);
            khanateMoment = decoded[`uid_${currentUserId}`] || null;
        } catch (e) {
            khanateMoment = null;
        }
        
        const wellspringRecord = localStorage.fl_tk_wellspring_moment || null;
        try {
            const decoded = JSON.parse(wellspringRecord);
            wellspringMoment = decoded[`uid_${currentUserId}`] || null;
        } catch (e) {
            wellspringMoment = null;
        }
        
        const calendarRecord = localStorage.fl_tk_calendar_moment || null;
        try {
            const decoded = JSON.parse(calendarRecord);
            calendarMoment = decoded[`uid_${currentUserId}`] || null;
        } catch (e) {
            calendarMoment = null;
        }
    }

    function debug(message) {
        console.debug(`[FL Time Keeper] ${message}`);
    }

    function error(message) {
        console.error(`[FL Time Keeper] ${message}`);
    }

    function tillNextStateUpdate() {
        const now = new Date();
        const earliestMoment = Math.min(
            tthMoment,
            // Any and all of Khanate, Balmoral, Wellspring and Calendar moments may yet be unknown at that point
            balmoralMoment || Number.MAX_SAFE_INTEGER,
            khanateMoment || Number.MAX_SAFE_INTEGER,
            wellspringMoment || Number.MAX_SAFE_INTEGER,
            calendarMoment || Number.MAX_SAFE_INTEGER,
        )

        if (now.getTime() > earliestMoment) {
            // TTH can be a little late and TTH endpoint can still display
            // old data past the specified moment. We'll take some time
            // until querying API again.
            return 10 * MILLISECONDS_IN_MINUTE;
        } else if (earliestMoment - now.getTime() < MILLISECONDS_IN_HOUR) {
            // When there is a less then one hour left, update the display
            // once per minute.
            return MILLISECONDS_IN_MINUTE;
        }

        const nowMinutes = now.getMinutes();
        const destMinutes = new Date(earliestMoment).getMinutes();

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

        updateInfoDisplay();
        debug(`Next display update in ${tillNextStateUpdate() / (MILLISECONDS_IN_MINUTE)} minutes.`);
        setTimeout(updateState, tillNextStateUpdate());
    }

    function calculateRemainingTime(moment) {
        const now = new Date().getTime();
        const minutesLeft = Math.round((moment - now) / (MILLISECONDS_IN_MINUTE));
        const hoursLeft = Math.floor(minutesLeft / 60) + (minutesLeft % 60 >= 30 ? 1 : 0);
        const daysLeft = hoursLeft >= 24 ? Math.ceil(hoursLeft / 24) : 0;

        let remainingText;

        debug(`Time till this moment comes: ${daysLeft} days or ${hoursLeft} hours or ${minutesLeft} minutes.`)

        if (daysLeft > 0) {
            const unit = daysLeft === 1 ? "day" : "days";

            remainingText = `in ${daysLeft} ${unit}.`;
        } else if (hoursLeft > 0) {
            const unit = hoursLeft === 1 ? "hour" : "hours";

            remainingText = `in ${hoursLeft} ${unit}.`;
        } else if (minutesLeft > 0) {
            const unit = minutesLeft === 1 ? "minute" : "minutes";
            remainingText = `in ${minutesLeft} ${unit}.`;
        } else {
            remainingText = `again someday.`;
        }

        return remainingText;
    }

    function insertTTHDisplay(cardsDiv) {
        const containerDiv = document.createElement("div");
        containerDiv.classList.add("media", "storylet");

        // We need this to prevent Fallen London Favourites extension from
        // inserting marked storylets _before_ our own.
        containerDiv.classList.add("storylet_favourite");
        containerDiv.style.cssText = "outline: none;";

        const displayDiv = document.createElement("div");
        displayDiv.className = "storylet__body";

        const contentsDiv = document.createElement("div");
        contentsDiv.className = "storylet__title-and-description";

        infoDisplay = document.createElement("div");
        tthContainer = containerDiv;

        contentsDiv.appendChild(infoDisplay);
        displayDiv.appendChild(contentsDiv);
        containerDiv.appendChild(displayDiv);

        cardsDiv.parentNode.insertBefore(containerDiv, cardsDiv.nextSibling);
    }

    function updateInfoDisplay() {
        const lines = [];

        if (infoDisplay == null) {
            return;
        }

        if (balmoralMoment != null) {
            const now = new Date().getTime();
            if (balmoralMoment > now) {
                const balmoralTimeRemaining = calculateRemainingTime(balmoralMoment);
                lines.push(`A Gift from Balmoral will be available ${balmoralTimeRemaining}`);
            } else {
                lines.push(`A Gift from Balmoral is waiting for you.`);
            }
        }

        if (tthMoment != null) {
            const remainingText = calculateRemainingTime(tthMoment);
            lines.push(`Time the Healer cometh ${remainingText}`);
        } else {
            lines.push(`Time the Healer cometh again someday.`);
        }

        const currentMakingWaves = qualities.get("Making Waves") || 0;
        const currentNotability = qualities.get("Notability") || 0;
        if (currentMakingWaves < currentNotability) {
            lines.push(`You will lose Notability! (${currentMakingWaves} MW < ${currentNotability} Nota)`);
        }

        if (khanateMoment != null) {
            const now = new Date().getTime();
            if (khanateMoment > now) {
                const khanateTimeRemaining = calculateRemainingTime(khanateMoment);
                lines.push(`A 'report' from Khagan's Palace is due ${khanateTimeRemaining}`);
            } else {
                lines.push(`A 'report' is waiting for you in Khanate.`);
            }
        }
        
        if (wellspringMoment != null) {
            const now = new Date().getTime();
            if (wellspringMoment > now) {
                const wellspringTimeRemaining = calculateRemainingTime(wellspringMoment);
                lines.push(`The Viric glow will fade in ${wellspringTimeRemaining}`);
            } else {
                lines.push(`The Viric glow has faded.`);
            }
        }
        
        if (calendarMoment != null) {
            const now = new Date().getTime();
            if (calendarMoment > now) {
                const calendarTimeRemaining = calculateRemainingTime(calendarMoment);
                lines.push(`A new Waswood Jaunt will be permitted in ${calendarTimeRemaining}`);
            } else {
                lines.push(`A new event awaits in the Waswood.`);
            }
        }


        if (lines.length === 0) {
            infoDisplay.style.display = "hidden";
        } else {
            while(infoDisplay.firstChild) {
                infoDisplay.removeChild(infoDisplay.lastChild);
            }

            for (const line of lines) {
                const info = document.createElement("h2");
                info.setAttribute("id", "tth_info_display");
                info.classList.add("media__heading", "heading", "heading--3", "storylet__heading");
                info.style.cssText = "text-align: center; display: hidden;";
                info.textContent = line;
                infoDisplay.appendChild(info);
            }

            infoDisplay.style.display = "block";
        }
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
            if (BALMORAL_GIFT_BRANCH_IDS.includes(this._originalRequest.branchId)) {
                balmoralMoment = new Date().getTime() + SEVEN_DAYS_IN_MILLISECONDS + EVENT_TRIGGER_LEEWAY;
                saveTrackedMoments();
            }

            if (KHANATE_REPORT_BRANCH_IDS.includes(this._originalRequest.branchId)) {
                khanateMoment = new Date().getTime() + SEVEN_DAYS_IN_MILLISECONDS + EVENT_TRIGGER_LEEWAY;
                saveTrackedMoments();
            }
            
            if (WELLSPRING_BRANCH_IDS.includes(this._originalRequest.branchId)) {
                wellspringMoment = new Date().getTime() + SEVEN_DAYS_IN_MILLISECONDS + EVENT_TRIGGER_LEEWAY;
                saveTrackedMoments();
            }
            
            if (WASWOOD_CALENDAR_BRANCH_IDS.includes(this._originalRequest.branchId)) {
                calendarMoment = new Date().getTime() + SEVEN_DAYS_IN_MILLISECONDS + EVENT_TRIGGER_LEEWAY;
                saveTrackedMoments();
            }

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
            currentUserId = data.character.user.id;
            debug(`Current user ID: ${currentUserId}`);
            loadTrackedMoments();

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

    function sendBypass(original_function) {
        return function (body) {
            this._originalRequest = arguments[0] ? JSON.parse(arguments[0]) : {};
            return original_function.apply(this, arguments);
        };
    }

    debug("Setting up API interceptors.");
    XMLHttpRequest.prototype.setRequestHeader = installAuthSniffer(XMLHttpRequest.prototype.setRequestHeader);
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);
    XMLHttpRequest.prototype.send = sendBypass(XMLHttpRequest.prototype.send);

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
                    const containers = node.getElementsByClassName("cards");
                    if (containers.length !== 0) {
                        insertionPoint = containers[0];
                    } else {
                        const existingCardContainers = document.getElementsByClassName("cards");
                        if (existingCardContainers.length !== 0) {
                            insertionPoint = existingCardContainers[0];
                        }
                    }
                }

                if (insertionPoint == null) {
                    if (node.classList.contains("storylets__welcome-and-travel")) {
                        insertionPoint = node;
                    } else {
                        const containers = node.getElementsByClassName("storylets__welcome-and-travel")
                        if (containers.length !== 0) {
                            insertionPoint = containers[0];
                        }
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

                const cardsContainers = node.getElementsByClassName("cards")
                if (cardsContainers.length !== 0 || node.classList.contains("cards")) {
                    tthContainer.remove();
                    tthContainer = infoDisplay = null;
                    break;
                }

                const travelContainers = node.getElementsByClassName("storylets__welcome-and-travel")
                if (tthContainer && travelContainers.length !== 0 || node.classList.contains("storylets__welcome-and-travel")) {
                    tthContainer.remove();
                    tthContainer = infoDisplay = null;
                    break;
                }
            }
        }
    }));
    mainContentObserver.observe(document, {childList: true, subtree: true});
}())
