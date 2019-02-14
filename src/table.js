import React from 'react'
import ReactTable from "react-table"
import axios from "axios"
import yaml from "js-yaml"
import { remove, isEqual, debounce, isEmpty } from "lodash"
import { Snackbar, Tooltip, Fab } from '@material-ui/core'
import { Delete } from '@material-ui/icons'
import HOC from "react-table/lib/hoc/selectTable"

import { tables } from './cfg'

import Modal from './m'

import "react-table/react-table.css"


const log = console.log.bind(console)
const SelectTable = HOC(ReactTable)

// http://postgrest.org/en/latest/api.html#horizontal-filtering-rows
const filterTokens = [
    ["=", 'eq.'],
    [">=", 'gte.'],
    [">", 'gt.'],
    ["<=", 'lte.'],
    ["<", 'lt.'],
    ["~", 'like.', s => s + "*"],
]
const rawFilterTokens = /^(eq|gt|gte|lt|lte|neq|like|ilike|in|is|fts|plfts|phfts|cs|cd|ov|sl|sr|nxr|nxl|adj|not)\./
const filterShorthands = /^[=><~]/


function generateColumns(fields) {
    const l = Object.keys(fields).map(k => {
        const column = {
            Header: k,
            accessor: k,
        }
        const { type } = fields[k]
        switch (type) {
            case "json":
                column.Cell = ({ row }) => <pre>{yaml.dump(row[k])}</pre>
                break;
            case "boolean":
                column.Cell = ({ row }) => <pre>{row[k] ? "✔" : "✘"}</pre>
                break;
            default:
                break;
        }
        return column
    })
    l.push({ expander: true })  // just a simple expander
    return l
}


function DeleteIcon({ show, onClick }) {
    if (!show) return null
    return <Tooltip title="Delete" style={{ position: 'absolute', right: 0, zIndex: 2000 }}>
        <Fab color="secondary">
            <Delete onClick={onClick} />
        </Fab>
    </Tooltip>
}


class Table extends React.Component {
    state = {
        data: [],
        pages: 0,
        loading: false,
        error: "",

        modalOpen: false,
        modalData: null,

        selection: [],
        // sorted: [],//[{ id: "events", desc: true }],
        // filtered: [],//[{ id: "test", value: "True" }, { id: "n", value: "1" }],
    }

    _cache = {}

    get uri() {
        return `/api/${this.props.table}`
    }

    create = async (result) => {
        const { data } = this.state
        const headers = {
            Accept: "application/vnd.pgrst.object+json",
            Prefer: "return=representation",
        }
        try {
            const resp = await axios.post(this.uri, result, { headers })
            data.unshift(resp.data)
            this.setState({ data })
        } catch (error) {
            this.setAjaxError(error)
        }
    }

    update = async (result) => {
        const { data } = this.state
        const { _id } = result
        const pre = data[_id]
        const diff = {}
        for (const [key, value] of Object.entries(result)) {
            if (!isEqual(value, pre[key])) {
                diff[key] = value
            }
        }
        if (isEmpty(diff)) {
            return
        }

        const params = {}
        for (const k of this.props.primary.split(",")) {
            params[k] = `eq.${pre[k]}`
        }

        try {
            await axios.patch(this.uri, diff, { params })
            Object.assign(pre, diff)
            this.setState({ data })
        } catch (error) {
            this.setAjaxError(error)
        }

    }

    delete = async (target) => {
        const params = {}
        for (const k of this.props.primary.split(",")) {
            params[k] = `eq.${target[k]}`
        }
        // log(params)
        const { data } = this.state
        try {
            await axios.delete(this.uri, { params })
            remove(data, (v) => isEqual(v, target))
            this.setState({ data })
        } catch (error) {
            this.setAjaxError(error)
        }
    }

    setAjaxError(error) {
        const { status, data: { message } } = error.response
        this.setState({ loading: false, error: `[${status}] ${message}` })
    }

    fetch = debounce(async ({ pageSize, page, sorted, filtered }) => {
        // log(filtered, sorted)

        const { history } = this.props

        if (history) {
            // const s = {}
            // if (filtered.length) {
            //     s.filtered = JSON.stringify(filtered)
            // }
            // if (sorted.length) {
            //     s.sorted = JSON.stringify(sorted)
            // }
            // const search = qs.stringify(s)
            // if (history.location.search !== search) {
            //     history.push({ search })
            // }
        }

        this.setState({ loading: true })
        const headers = {
            Prefer: "count=exact",
            // Range: `${pageSize * page}-${pageSize * (page + 1) - 1}`,
        }

        const params = { offset: pageSize * page, limit: pageSize }
        filtered.map(({ id, value }) => {
            if (value.match(rawFilterTokens)) {
                return params[id] = value
            }
            if (!value.match(filterShorthands)) {
                return params[id] = `eq.${value}`
            }
            for (const [match, holder, ext] of filterTokens) {
                if (value.startsWith(match)) {
                    value = value.replace(match, holder)
                    if (ext) {
                        value = ext(value)
                    }
                    return params[id] = value
                }
            }
        })

        const order = []
        for (let { id, desc } of sorted) {
            if (desc) { id += ".desc" }
            order.push(id)
        }
        if (order.length) {
            params.order = order.join(",")
        }

        try {
            const resp = await axios.get(this.uri, { params, headers })
            const pages = Math.ceil(resp.headers["content-range"].split('/')[1] / pageSize)
            const data = resp.data.map((i, idx) => {
                i._id = idx
                this._cache[idx] = i
                return i
            })
            this.setState({ data, pages, loading: false, selection: [] })
        } catch (error) {
            this.setAjaxError(error)
        }
    }, 300, { leading: true, trailing: true })

    onResizedChange = debounce((resized) => {
        // log(resized)
        localStorage.setItem(`resized:${this.props.table}`, JSON.stringify(resized))
    }, 100, { leading: true, trailing: true })

    toggleSelection = (_id, shift, row) => {
        // log(shift,row)
        const { selection } = this.state
        const idx = selection.indexOf(_id)
        if (idx >= 0) {
            selection.splice(idx, 1)
        } else {
            selection.push(_id)
        }
        this.setState({ selection })
    }

    get selectAll() {
        const { data, selection: { length } } = this.state
        return length && length === data.filter(i => i._id != null).length
    }

    toggleAll = () => {
        const selection = this.selectAll ? [] : this.state.data.map(i => i._id).filter(x => x != null)
        this.setState({ selection })
    }

    isSelected = (_id) => {
        return this.state.selection.includes(_id)
    }

    get table() {
        const { hoc, primary, fields, sorted, filtered, resized, filterable, tiny, pageSize, history } = this.props
        const { toggleSelection, toggleAll, isSelected, selectAll } = this
        const { loading, pages, data } = this.state

        const HOCProps = {
            selectAll,
            isSelected,
            toggleSelection,
            toggleAll,
            selectType: "checkbox",
        }

        const T = (hoc && primary) ? SelectTable : ReactTable

        const columns = generateColumns(fields)

        const search = {}
        // if (history) {
        //     for (const [k, v] of Object.entries((qs.parse(history.location.search)))) {
        //         search[k] = JSON.parse(v)
        //     }
        // }

        // https://react-table.js.org/#/story/controlled-component
        return <T
            className="--striped -highlight"
            // keyField='key'
            // ref={r => (this.checkboxTable = r)}
            columns={columns}
            filterable={filterable == null ? !tiny : filterable}
            sortable={!tiny}
            data={data}
            // resolveData={(data) => data.map((i, _id) => ({ ...i, _id }))}  // for selection
            pages={pages}
            loading={loading}
            defaultResized={resized}
            onResizedChange={this.onResizedChange}
            defaultFiltered={search.filtered || filtered}
            defaultSorted={search.sorted || sorted}
            // filtered={filtered}
            // sorted={sorted}
            // onSortedChange={sorted => this.setState({ sorted })}
            // onFilteredChange={filtered => this.setState({ filtered })}
            manual
            onFetchData={this.fetch}
            defaultPageSize={tiny ? 1 : (pageSize || 10)}
            showPagination={!tiny}
            getTheadThProps={(state, row, column, instance) => {
                if (column.id !== "_selector") return {}
                return {
                    onDoubleClick: (e) => {
                        // for create
                        this.setState({ modalOpen: true, modalData: null })
                    }
                }
            }}
            getTdProps={(state, row, column, instance) => {
                if (column.id !== "_selector") return {}
                return {
                    onDoubleClick: (e) => {
                        // for update
                        this.setState({ modalOpen: true, modalData: row.original })
                    }
                }
            }}
            SubComponent={(row) => {
                // log(row)
                function c(key, token) {
                    const value = row.original[key]
                    const [table, column] = token.split(".")
                    const filtered = [{ id: column, value: `eq.${value}` }]
                    return <>
                        <h3>{`${key}->${token} = ${value}`}</h3>
                        <Table filtered={filtered} tiny {...tables[table]} />
                    </>
                }

                function c2(key, token) {
                    const value = row.original[key]
                    const [table, column] = token.split(".")
                    const filtered = [{ id: column, value: `eq.${value}` }]
                    return <>
                        <h3>{`${token}->${key} = ${value}`}</h3>
                        <Table filtered={filtered} filterable={false}
                            pageSize={5} {...tables[table]} />
                    </>
                }

                const { fields, follows } = this.props

                const links = []
                for (const [column, { ref }] of Object.entries(fields)) {
                    if (!ref) continue
                    links.push(c(column, ref))
                }
                for (const [follow, column] of Object.entries(follows)) {
                    links.push(c2(column, follow))
                }
                return <div className="sub-component">
                    <pre>{yaml.dump(row.original)}</pre>
                    {links}
                </div>
            }}
            {...HOCProps}
        >
            {(state, makeTable, instance) => {
                // https://react-table.js.org/#/story/functional-rendering
                return <div>
                    {makeTable()}
                    {/* <JSONTree data={state} /> */}
                </div>
            }}
        </T>
    }

    get error() {
        const { error } = this.state
        return <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            open={!!error}
            autoHideDuration={3000}
            onClose={() => this.setState({ error: "" })}
            message={error}
        />
    }

    get deleteIcon(){
        const { data, selection, } = this.state
        return <DeleteIcon show={selection.length} onClick={() => {
            const pks = this.props.primary.split(",")
            const text = "Delete?\n" + selection.map(
                i => pks.map(k => data[i][k]).join(",")
            ).join("\n")
            if (window.confirm(text)) {
                for (const _id of selection) {
                    this.delete(this._cache[_id])
                }
                this.setState({ selection: [] })
            }
        }} />
    }

    get modal() {
        const { modalOpen, modalData } = this.state
        const { fields } = this.props
        return <Modal
            open={modalOpen}
            close={() => this.setState({ modalOpen: false })}
            data={modalData}
            fields={fields}
            submit={(data) => {
                this.setState({ modalOpen: false })
                if (modalData) {
                    this.update(data)
                } else {
                    this.create(data)
                }
            }}
        />
    }

    render() {
        return <div>
            {this.deleteIcon}
            {this.error}
            {this.table}
            {this.modal}
        </div>
    }
}

export default Table
