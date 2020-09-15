/**
 * @file        Schema 'Thing'.
 * @module      Thing
 * @author      Gordon Ansell   <contact@gordonansell.com> 
 * @copyright   Gordon Ansell, 2020.
 * @license     MIT
 */

'use strict';

const syslog = require("greenhat-util/syslog");

class BaseType
{
    // Properties.
    props = {};

    // Add context?
    static addContext = true;

    // Context.
    static context = 'https://schema.org';

    // Checks.
    static checks = {
        Article: {
            compulsory: ['name', 'url', 'datePublished', 'headline', 'url'],
            recommended: ['image', 'dateModified', 'author', 'publisher'],
        },
        BlogPosting: {
            compulsory: ['name', 'url', 'datePublished', 'headline', 'url'],
            recommended: ['image', 'dateModified', 'author', 'publisher'],
        },
    }

    /**
     * Constructor.
     * 
     * @param   {string}    id          ID.
     */
    constructor(id = null)
    {
        if (BaseType.addContext) {
            this.context(BaseType.context);
        }
        this.type(this.constructor.name);
        if (id) {
            this.id(id);
        }
    }

    /**
     * Set the addContext flag.
     * 
     * @param   {boolean}   flag        Flag value.
     */
    static setAddContext(flag)
    {
        BaseType.addContext = flag;
    }

    /**
     * Set the ID.
     * 
     * @param   {string}    val         ID value.
     * @return  {object}                Ourself.                       
     */
    id(val)
    {
        return this.setProp('@id', val);
    }

    /**
     * Set the context.
     * 
     * @param   {string}    val         Context value.
     * @return  {object}                Ourself.                       
     */
    context(val)
    {
        return this.setProp('@context', val);
    }

    /**
     * Set the type.
     * 
     * @param   {string}    val         Type value.
     * @return  {object}                Ourself.                       
     */
    type(val)
    {
        return this.setProp('@type', val);
    }

    /**
     * Set a property.
     * 
     * @param   {string}    name        Property name.
     * @param   {any}       val         Property value. 
     * @return                          This.
     */
    setProp(name, val)
    {
        this.props[name] = val;
        return this;
    }

    /**
     * Do we have a property?
     * 
     * @param   {string}    name        Name of property to test.
     * @return  {boolean}               True if we have it, else false. 
     */
    hasProp(name) 
    {
        return (name in this.props);
    }

    /**
     * Get a property.
     * 
     * @param   {string}    name        Name of property to get.
     * @return  {any}                   Property value.
     */
    getProp(name)
    {
        if (this.hasProp(name)) {
            return this.props[name];
        }
        throw new Error(`Property '${name}' not found in '${this.constructor.name}'.`)
    }

    /**
     * Get all the properties.
     * 
     * @return  {object}                Properties. 
     */
    getProps()
    {
        return this.props;
    }

    /**
     * Resolve properties.
     * 
     * @return  {object}                Resolved properties. 
     */
    resolveProps()
    {
        let ret = {};

        for (let key in this.props) {
            if (this.props[key] instanceof BaseType) {
                ret[key] = this.props[key].resolveProps();
            } else if (Array.isArray(this.props[key])) {
                let all = [];
                for (let item of this.props[key]) {
                    if (item instanceof BaseType) {
                        all.push(item.resolveProps());
                    } else {
                        all.push(item);
                    }
                }
                ret[key] = all;
            } else {
                ret[key] = this.props[key];
            }
        }

        return ret;
    }

    /**
     * Check the schema.
     * 
     * @param   {string}        pref    Message prefix.
     * @return  {number}                0: ok, 1 has advs, 2, has errs, 3 has both. 
     */
    check(pref = '')
    {
        let ret = 0;

        let checks = null;

        if (BaseType.checks[this.constructor.name]) {
            checks = BaseType.checks[this.constructor.name];
        } else {
            return 0;
        }

        if (checks.recommended) {
            let has = false;
            for (let field of checks.recommended) {
                if (!this.hasProp(field)) {
                    syslog.advice(`[${pref}] Field '${field}' is recommended for schema type '${this.constructor.name}'.`);
                    has = true;
                }
            }
            if (has) ret + 1;
        }

        this.errs = [];

        if (checks.compulsory) {
            let has = false;
            for (let field of checks.compulsory) {
                if (!this.hasProp(field)) {
                    syslog.error(`[${pref}] Schema type '${this.constructor.name}' must have a '${field}' defined.`);
                    has = true;
                }
            }
            if (has) ret += 2;
        }


        return ret;
    }
}

module.exports = BaseType;
