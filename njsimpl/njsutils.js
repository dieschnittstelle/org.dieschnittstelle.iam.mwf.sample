/**
 * @author Jörn Kreutel
 */

/*
 * functions that shall also be used internally can be declared like this:
 */
var startsWith = function startsWith(string, substring) {
    return string.indexOf(substring) == 0;
};

var endsWith = function endsWith(string, substring) {
    return string.length >= substring.length && string.substring(string.length - substring.length) == substring;
}

module.exports = {

    getIPAddress : function getIPAddress() {
        var interfaces = require('os').networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];

            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                    return alias.address;
            }
        }

        return '127.0.0.1';
    },

    clearNode : function clearNode(node) {
        while (node.firstChild) {
            console.log("removing child node: " + node.firstChild);
            node.removeChild(node.firstChild);
        }
    },

    /*
     * utility treat null as empty string
     */
    nullAsEmptyString : function nullAsEmptyString(val) {
        return (val == null ? "" : val);
    },

    /*
     * some substring functionality
     */
    substringAfter : function substringAfter(string, separator) {
        //console.log("substringAfter(\'" + string + "\',\'" + separator + "\')");
        var split = string.split(separator);
        //console.log("split result is: " + split);
        var rest = "";
        for (var i = 1; i < split.length; i++) {
            if (i != 1) {
                rest += separator;
            }
            rest += split[i]
        }

        return rest;
    },

    startsWith : startsWith,

    replaceWith : function replaceWith(string, token, replacement) {
        return string.replace(token, replacement);
    },

    endsWith : endsWith,

    trimQuotes : function trimQuotes(string) {
        var trimmed = string.trim();
        if ((startsWith(trimmed, "\"") && endsWith(trimmed, "\"")) || (startsWith(trimmed, "\'") && endsWith(trimmed, "\'"))) {
            return trimmed.substring(1, trimmed.length - 1);
        }
        return string;
    }
};
