/*
 * joern kreutel
 *  most of the code taken from https://github.com/yaronn/ws.js/blob/master/lib/handlers/client/mtom/mime-reader.js
 *
 * yet, some small but important adaptations were required:
 * - consider that onPartEnd() has not been called on write() return
 * - change initialisation of headers from [] to Object
 */

// imports
var MultipartParser = require('formidable/lib/multipart_parser').MultipartParser;
var fs = require('fs');
var utils = require("./njsutils");

var loggerEnabled = false;

function MultipartReader() {
    this.parts = new Array();
    this.part = null;
    this.data = new Buffer('');
    this.headers = new Object();
    this.curr_header_name = null;
    this.curr_header_value = null;
    this.parser = null;
};

exports.MultipartReader = MultipartReader;

MultipartReader.prototype.init = function(boundary, onend) {
    if (loggerEnabled) {
        console.log("init()");
    }

    var that = this;

    this.parser = new MultipartParser()
    this.parser.initWithBoundary(boundary)

    this.parser.onPartBegin = function() {
        if (loggerEnabled) {
            console.log("parser.onPartBegin()");
        }

        if (that.data && that.data.length && that.data.length > 0) {
            if (loggerEnabled) {
                console.log("onPartBegin(): there is still data left of length " + data.length + " call onPartEnd() and then resume...");
            }
            onPartEnd();
            if (loggerEnabled) {
                console.log("onPartBegin(): resume")
            }
        }

        that.part = {}
        that.headers = new Object();
        that.curr_header_name = ""
        that.curr_header_value = ""
        that.data = new Buffer('')
    }

    this.parser.onHeaderField = function(b, start, end) {
        if (loggerEnabled) {
            console.log("parser.onHeaderField(): " + start + "/" + end);
        }
        that.curr_header_name = b.slice(start, end).toString()
        if (loggerEnabled) {
            console.log("got header field: " + that.curr_header_name);
        }
    };

    this.parser.onHeaderValue = function(b, start, end) {
        if (loggerEnabled) {
            console.log("parser.onHeaderValue(): " + start + "/" + end);
        }
        that.curr_header_value = b.slice(start, end).toString()
        if (loggerEnabled) {
            console.log("got header value: " + that.curr_header_value);
        }
    }

    this.parser.onHeaderEnd = function() {
        if (loggerEnabled) {
            console.log("parser.onHeaderEnd()");
        }
        that.headers[that.curr_header_name.toLowerCase()] = that.curr_header_value
    }

    this.parser.onHeadersEnd = function() {
        if (loggerEnabled) {
            console.log("parser.onHeadersEnd()");
        }
    }

    this.parser.onPartData = function(b, start, end) {
        if (loggerEnabled) {
            console.log("parser.onPartData(): " + start + "/" + end);
        }
        that.data = Buffer.concat([that.data, b.slice(start, end)])
    }

    this.parser.onPartEnd = function() {
        if (loggerEnabled) {
            console.log("parser.onPartEnd(): length of data is " + that.data.length + ". Headers are: " + JSON.stringify(that.headers));
        }
        that.part.data = that.data;
        that.part.headers = that.headers;
        // push the part on the list of parts
        that.parts.push(that.part)
        // JK add this for resetting data and headers
        that.data = new Buffer('');
        that.headers = new Object();
    }

    this.parser.onEnd = function() {
        if (loggerEnabled) {
            console.log("parser.onEnd()");
        }
        // run the onend function
        onend(that.parts);
    }
};

MultipartReader.prototype.resume = function() {
    if (this.data.length > 0) {
        if (loggerEnabled) {
            console.log("resume(): resuming for data of length " + this.data.length);
        }
        this.part.data = this.data
        this.part.headers = this.headers
        this.parts.push(this.part)
    }
};

MultipartReader.prototype.read_multipart = function(payload, boundary) {
    this.parser.write(payload);
};

/*
 * a function for postprocessing multipart data after parsing
 *
 */
var postprocessMultipartData = function(parts, filepath, uripath, ondone) {
    if (loggerEnabled) {
        console.log("processMultipartData: " + parts.length + " parts...");
    }

    // we create an object
    var formdata = new Object();

    // write the parts
    for (var i = 0; i < parts.length; i++) {
        var headers = parts[i].headers;
        var data = parts[i].data;
        if (loggerEnabled) {
            console.log("processing part of length " + data.length + " with headers: " + JSON.stringify(headers));
        }

        // we read and parse the content-disposition header to extract information on form field, datatype etc
        var contentDispo = new Object();
        var contentDispoHeader = headers["content-disposition"];
        if (contentDispoHeader && utils.startsWith(contentDispoHeader, "form-data")) {
            var dispoParts = contentDispoHeader.split(";");
            if (loggerEnabled) {
                console.log("dispoParts are: " + dispoParts);
            }
            for (var j = 0; j < dispoParts.length; j++) {
                var currentPart = dispoParts[j].trim();
                if (utils.startsWith(currentPart, "filename")) {
                    contentDispo["filename"] = utils.trimQuotes(utils.substringAfter(currentPart, "="));
                } else if (utils.startsWith(currentPart, "name")) {
                    contentDispo["name"] = utils.trimQuotes(utils.substringAfter(currentPart, "="));
                }
            }
            if (loggerEnabled) {
                console.log("extracted content-disposition: " + JSON.stringify(contentDispo));
            }

            // we look at the content-type header
            var contentType = headers["content-type"];
            if (contentType) {
                if (loggerEnabled) {
                    console.log("got content-type header: " + contentType + ". about to write file...");
                }

                if (contentDispo.filename) {
                    var filename = contentDispo["filename"];

                    var dirname = "";
                    // this should be factored-out into some mime type handlin utility
                    if (utils.startsWith(contentType, "image/")) {
                        dirname = "img/";
                    } else if (utils.startsWith(contentType, "audio/")) {
                        dirname = "wav/";
                    } else if (utils.startsWith(contentType, "video/")) {
                        dirname = "mov/";
                    } else if (utils.startsWith(contentType, "text/html")) {
                        dirname = "html/";
                    } else if (utils.startsWith(contentType, "text/")) {
                        dirname = "txt/";
                    } else {
                        dirname = "bin/"
                    }

                    // adjust the content type
                    if (utils.endsWith(filename, ".ogg")) {
                        formdata.contentType = "audio/ogg";
                    } else {
                        // we add the content-type to the formdata
                        formdata.contentType = contentType;
                    }

                    // we add here a timestamp as unique identifier
                    formdata[contentDispo.name] = uripath + dirname + Date.now() + "_" + filename;
                    fs.writeFile(filepath + formdata[contentDispo.name], data, function(err) {
                        if (err) {
                            console.error("could not write file: " + err);
                        } else {
                            // if the first file has not been written before saving the second file has been initiated, we seem to get the latter's filename in the log message of the former!
                            if (loggerEnabled) {
                                console.log("part data was saved in file " + filepath + formdata[contentDispo.name]);
                            }
                        }
                    });
                } else {
                    // TODO: we might implement a filename generation for dealing with this case (need to map content-type to extensions for this purpose. mapping could be reused for creating content-type header in response)
                    if (loggerEnabled) {
                        console.log("no filename specified. Will not write data...");
                    }
                }

            } else if (contentDispo["name"]) {
                if (loggerEnabled) {
                    console.log("no content-type header specified. Will add data as object property of name " + contentDispo["name"]);
                }
                // we concat with "" as internally data is an array of ascii codes
                formdata[contentDispo["name"]] = data + "";
            }
        } else {
            if (loggerEnabled) {
                console.log("ignore current part. It does not specify a content-disposition header: " + JSON.stringify(headers));
            }
        }

    }

    if (ondone) {
        if (loggerEnabled) {
            console.log("now calling ondone()...");
        }
        ondone(formdata);
    } else {
        console.log("no ondone() callback specified.")
    }
}

exports.handleMultipartRequest = function(req, res, filepath, uripath, ondone) {
    // handle multipart requests
    var contentType = req.headers["content-type"];
    console.log("content-type is: " + contentType);

    if (utils.startsWith(contentType, "multipart/form-data")) {
        console.log("got a multipart request");
        var boundary = utils.substringAfter(contentType, "boundary=");
        //console.log("boundary for form-data: " + boundary);

        /* we parse the multipart on obtaining the data, it seems that nodejs passes us the data in arbitrary chunks, so the reader needs to keep state over multiple callbacks for on() */

        var reader = new MultipartReader();
        //console.log("using reader: " + reader);

        reader.init(boundary, function onend(data) {
            console.log("parsing multipart data done");
            postprocessMultipartData(data, filepath, uripath, ondone);
        });

        /* data might be read out in chunks, and for each chunk the callback method is called, i.e. the reader that holds the complete state of reading data must have wider scope than the callback function */
        req.on('data', function(data) {
            // console.log("reading a chunk of multipart data...");
            reader.read_multipart(data);
        });

        // this return is issued asynchronously - immediately after starting reading the data!
        return true;
    }

    return false;
}
/*
 * we normalise value here
 */
function normaliseFieldValue(value) {
    if (value == "true")
        return true;
    if (value == "false")
        return false;
    return decodeURIComponent(value);
}

exports.parseSimpleFormData = function(data) {
    var formdata = new Object();

    // we split by '&' and then by '=' and decode the values
    var fields = (data + "").split("&");
    for (var i = 0; i < fields.length; i++) {
        var fvp = fields[i].split("=");
        var fieldname = decodeURIComponent(fvp[0]);
        var fieldvalue = normaliseFieldValue(fvp[1]);
        //console.log("fieldname: " + fieldname);
        if (utils.endsWith(fieldname, "[]")) {
            //console.log("found an array valued field: " + fvp);
            var rawfieldname = fieldname.substring(0, fieldname.length - 2);
            //console.log("rawfieldname is: " + rawfieldname);
            if (!formdata[rawfieldname]) {
                formdata[rawfieldname] = new Array();
            }
            formdata[rawfieldname].push(fieldvalue)
        } else {
            formdata[fieldname] = fieldvalue;
        }
    }

    return formdata;
}
