(function () {
    let authToken = null;
    let tthMoment = null;
    let tthDisplay = null;
    let tthContainer = null;

    function debug(message) {
        console.debug(`[FL Time Keeper] ${message}`);
    }

    function tillNextStateUpdate() {
        const now = new Date();

        if (tthMoment > now.getTime() &&  tthMoment - now.getTime() < 60 * 60 * 1000) {
            return 60 * 1000;
        }

        const nowMinutes = now.getMinutes();
        const destMinutes = new Date(tthMoment).getMinutes();

        if (nowMinutes < destMinutes) {
            return (destMinutes - nowMinutes) * 60 * 1000;
        } else {
            return ((60 - nowMinutes) + destMinutes) * 60 * 1000;
        }
    }

    function updateState() {
        const nowMoment = new Date().getTime();

        if (tthMoment == null|| nowMoment >= tthMoment) {
            getTTHMoment()
                .then(moment => {
                    tthMoment = moment;
                    updateState();
                });
            return;
        }

        updateTTHDisplay();
        debug(`Next display update in ${tillNextStateUpdate() / (60 * 1000)} minutes.`);
        setTimeout(updateState, tillNextStateUpdate());
    }

    function updateTTHDisplay() {
        if (tthDisplay == null) {
            return;
        }

        const now = new Date().getTime();

        const minutesLeft = Math.round((tthMoment - now) / (60 * 1000));
        const hoursLeft = Math.floor(minutesLeft / 60);
        const daysLeft = Math.floor(hoursLeft / 24);

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

        tthDisplay = title;
        tthContainer = containerDiv;

        displayDiv.appendChild(contentsDiv);
        containerDiv.appendChild(displayDiv);

        cardsDiv.parentNode.insertBefore(containerDiv, cardsDiv.nextSibling);
    }

    async function getTTHMoment() {
        debug("Trying to fetch user info from server...");
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

    debug("Setting up API interceptors.");
    XMLHttpRequest.prototype.setRequestHeader = installAuthSniffer(XMLHttpRequest.prototype.setRequestHeader);

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
                    tthContainer = tthDisplay = null;
                    break;
                }
            }
        }
    }));
    mainContentObserver.observe(document, {childList: true, subtree: true});
}())
