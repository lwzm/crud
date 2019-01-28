import React from 'react'
import { Modal, Button, MenuItem, FormControl } from '@material-ui/core'
import { CheckboxWithLabel, TextField } from 'formik-material-ui'
import * as ui from 'formik-material-ui'
import { Formik, Form, Field } from 'formik'

function F({ data, submit, fields }) {
    const values = { ...data }
    for (const [key, { type }] of Object.entries(fields)) {
        if (!type) continue
        if (key in values && type === "json") {
            values[key] = JSON.stringify(values[key], null, 2)
        } else if (type.startsWith("datetime")) {
            const v = values[key]
            values[key] = v ? v.slice(0, 19) : ""
        }
    }
    return <Formik
        initialValues={values}
        validate={(values) => {
            const errors = {}
            for (const [key, { type }] of Object.entries(fields)) {
                if (key in values && type === "json") {
                    try {
                        JSON.parse(values[key])
                    } catch (e) {
                        errors[key] = e.message
                    }
                }
            }
            return errors
        }}
        onSubmit={(values, { setSubmitting, setValues }) => {
            const result = { ...values }
            for (const [key, { type }] of Object.entries(fields)) {
                if (key in values && type === "json") {
                    result[key] = JSON.parse(result[key])
                }
            }
            submit(result)
            setSubmitting(false)
        }}
    >
        <Form>
            <FormControl fullWidth>
                {Object.entries(fields).map(([name, { type, multiline, readonly, select, component }]) => {
                    const props = {
                        name,
                        key: name,
                        label: name,
                        margin: "dense",
                    }
                    if (select) {
                        props.select = true
                    }
                    if (multiline) {
                        props.multiline = true
                    }
                    if (readonly) {
                        props.InputProps = { readOnly: true }
                    }
                    switch (type) {
                        case "boolean":  // https://stackworx.github.io/formik-material-ui/?selectedKind=Formik&selectedStory=Selectors&full=0&addons=1&stories=1&panelRight=0&addonPanel=storybook%2Factions%2Factions-panel
                            props.Label = { label: name }
                            props.component = ui[component] || CheckboxWithLabel
                            break;
                        default:
                            props.type = type
                            props.component = ui[component] || TextField
                            break;
                    }

                    return <Field {...props}>
                        {select && select.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Field>
                })}
                <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                > Go </Button>
            </FormControl>
        </Form>
    </Formik>
}

function getModalStyle() {
    const top = 50;
    const left = 50;

    return {
        top: `${top}%`,
        left: `${left}%`,
        transform: `translate(-${top}%, -${left}%)`,
        position: 'absolute',
        padding: '2em',
        width: "20em",
        backgroundColor: "white",
        outline: 'none',
        overflowY: "auto",
        maxHeight: "calc(100vh - 50px)",
        // maxWidth: "100%",
    }
}

export default function (props) {
    const { open, close } = props
    return <Modal open={open} onClose={close} >
        <div style={getModalStyle()}>
            <F {...props} />
        </div>
    </Modal>
}