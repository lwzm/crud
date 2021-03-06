import React from "react"
import { HashRouter as Router, Route, Link } from "react-router-dom"
import { MenuList, MenuItem, Grid } from "@material-ui/core"
import { Formik, Field } from 'formik'
import { get, post } from 'axios'
import cfg from './cfg'
import T from './table'

const types = {
    "integer": "number",
    "smallint": "number",
    "bigint": "number",

    "jsonb": "json",
    "json": "json",

    "text": "text",
    "character varying": "text",
    "character": "text",

    "boolean": "boolean",

    "timestamp without time zone": "datetime-local",
    "timestamp with time zone": "datetime-local",
    "date": "date",

    "double precision": "number",
    "real": "number",
    "numeric": "number",
}


function g(t) {
    return ({ history }) => {
        const s = localStorage.getItem(`resized:${t.table}`)
        const resized = s ? JSON.parse(s) : undefined
        return <T hoc={true} history={history} resized={resized} {...t} />
    }
}

export default class App extends React.Component {
    state = {
        tables: []
    }

    componentWillMount() {
        this.fetchDefinitions()
    }

    async fetchDefinitions() {
        // try {
        //     const { data } = await get("/tables.json")
        //     Object.assign(cfg.tables, data)
        // } catch (error) {
        //     const { data: { definitions } } = await get("/api/")
        //     Object.assign(cfg.tables, this.buildMenu(definitions))
        // }
        const { data: { definitions } } = await get("/api/")
        Object.assign(cfg.tables, this.buildMenu(definitions))
        this.setState({ tables: Object.values(cfg.tables) })
    }

    buildMenu(definitions) {
        const fkRE = /fk table='([^']+)' column='([^']+)'/
        const tables = {}
        for (const table in definitions) {
            const { properties } = definitions[table]
            const fields = {}
            let primary = []
            for (const column in properties) {
                const info = {}
                const { format, description, maxLength } = properties[column]
                const type = types[format]
                const fk = fkRE.exec(description)
                if (type) {
                    info.type = type
                    if (type === 'json') {
                        info.multiline = true
                    }
                    else if (type === 'text' && !maxLength) {
                        info.multiline = true
                    }
                }
                if (fk) {
                    info.ref = fk.slice(1, 3).join('.')
                }
                if (description && description.indexOf("<pk") > -1) {
                    primary.push(column)
                }
                fields[column] = info
            }
            primary = primary.join(",") || null
            tables[table] = { primary, fields, table, follows: {} }
        }

        function _reg(token, key) {
            const [table, column] = token.split(".")
            const t = tables[table]
            if (t) {
                t.follows[key] = column
            }
        }

        for (const { table, fields } of Object.values(tables)) {
            for (const [column, { ref }] of Object.entries(fields)) {
                if (ref) {
                    _reg(ref, `${table}.${column}`)
                }
            }
        }

        return tables
    }

    renderHome = () => {
        return <Formik
            onSubmit={async (values, actions) => {
                await post("/auth", values)
                await this.fetchDefinitions()
                actions.setSubmitting(false)
            }}
        >
            {({ handleSubmit }) => <form onSubmit={handleSubmit}>
                <Field name="role" />
                <button type="submit">Login</button>
            </form>
            }
        </Formik>
    }

    render() {
        const { tables } = this.state
        return <Router>
            <Grid container spacing={0}>
                <Grid item xs={1}>
                    <MenuList className="menu-list" >
                        {tables.map(({ table }) => <Link key={table} to={`/${table}`}>
                            <MenuItem>{table}</MenuItem>
                        </Link>)}
                    </MenuList>
                </Grid>
                <Grid item xs={11}>
                    <div style={{ width: 'auto' }}>
                        <Route exact path="/" component={this.renderHome} />
                        {tables.map((t, idx) => {
                            return <Route key={idx} exact path={`/${t.table}`} component={g(t)} />
                        })}
                    </div>
                </Grid>
            </Grid>
        </Router>
    }
}
