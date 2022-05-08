(function () {
    const DONE = 4;
    let authToken = null;
    let tthMoment = null;
    let tthDisplay = null;

    function debug(message) {
        console.debug(`[FL Time Keeper] ${message}`);
    }

    function updateTTHDisplay() {
        if (tthDisplay == null) {
            return;
        }

        const now = new Date().getTime();

        const minutesLeft = Math.round((tthMoment - now) / (60 * 1000));
        const hoursLeft = Math.floor(minutesLeft / 60);
        const daysLeft = Math.floor(hoursLeft / 24);

        let remainingText = "soon.";

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

                getTTHMoment()
                    .then(moment => {
                        tthMoment = moment;
                        updateTTHDisplay();
                    });
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

            for (let n = 0; n < mutation.addedNodes.length; n++) {
                const node = mutation.addedNodes[n];

                if (node.nodeName.toLowerCase() === "div") {
                    const containers = node.getElementsByClassName("cards")
                    if (containers.length !== 0) {
                        insertTTHDisplay(containers[0]);
                        updateTTHDisplay();
                    }
                }
            }
        }
    }));
    mainContentObserver.observe(document, {childList: true, subtree: true});
}())
