const debugLogLabel = true
const debugLogImportance = true

function ProcessInbox() {
    var seenLabels: { [id: string]: GoogleAppsScript.Gmail.GmailLabel; } = {}
    var re = /\[([^\/]+)\/([^\/\]]+)\].*?\/?(?:([a-zA-Z]*):)?/
    GmailApp.getInboxThreads().forEach(function(thread) {
        if (debugLogLabel || debugLogImportance) Logger.log(thread.getFirstMessageSubject())
        // Don't touch threads that have been read.
        if (!thread.isUnread()) {
            if (debugLogLabel || debugLogImportance) Logger.log("not unread, skipping")
            return
        }

        // Extract a GitHub-specific label from the message, if possible.
        var messages = thread.getMessages()
        var labelName = labelFromMsg(messages[0])
        // Not a GitHub notification.
        if (labelName == "") {
            if (debugLogLabel || debugLogImportance) Logger.log("no label, skipping")
            return
        }


        if (debugLogLabel) Logger.log("label: %s", labelName)

        // Label the message, creating the label first if necessary.
        if (!seenLabels[labelName]) {
            var label = GmailApp.getUserLabelByName(labelName)
            if (!label) {
                if (debugLogLabel) Logger.log("creating label")
                label = GmailApp.createLabel(labelName)
            }
            seenLabels[labelName] = label
        }
        thread.addLabel(seenLabels[labelName])

        if (thread.isImportant()) {
            // If a thread has starred messages or is marked as important, don't change it.
            if (debugLogImportance) {
                Logger.log("already important")
            }
        } else if (thread.hasStarredMessages() || shouldMarkImportant(messages)) {
            // Messages in this thread indicate that we should bump it.
            if (debugLogImportance) Logger.log("marking as important and starring")
            thread.markImportant()
            // Marking as important/unimportant doesn't really do much with Inbox once you
            // enable bundling for all of the labels. Star messages that relate to us.
            // (We should really move this into `shouldMarkImportant` so that it can star
            // the correct message and not just the last one, but let's try this first).
            messages[messages.length-1].star()
        } else {
            if (debugLogImportance) Logger.log("marking as unimportant")
            thread.markUnimportant()
        }
    })
}

function labelFromMsg(msg: GoogleAppsScript.Gmail.GmailMessage): string {
    var reList = /List-Archive: https:\/\/github\.com\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/
    var raw = msg.getRawContent()
    var match = reList.exec(raw)
    if (!match) return ""
    // var org = match[1]
    var repo = match[2]
    var pkg = ""

    var rePkg= /[ \/]([a-zA-Z0-9]+):/
    match = rePkg.exec(msg.getSubject())

    if (!match) {
        return repo
    }
    return repo + "/" + match[1]
}

function shouldMarkImportant(msgs: GoogleAppsScript.Gmail.GmailMessage[]): boolean {
    var reReason = /X-GitHub-Reason: (.*)/
    for (let msg of msgs) {
        if (!msg.isUnread()) continue
        var match = reReason.exec(msg.getRawContent())
        if (!match) continue
        // Other values are "mention" and "assign", both of
        // which seem important.
        if (match[1] != "subscribed") {
            if (debugLogImportance) Logger.log("imporant because reason is %s", match[1])
            return true
        }
    }
    // The thread contains nothing of interest; might as well mark as unimportant.
    return false
}

function deleteAllLabels() {
    GmailApp.getUserLabels().forEach(function(label) {
        if (debugLogLabel) Logger.log("deleting label %s", label.getName())
        GmailApp.deleteLabel(label)
    })
}
