import { Component, HostListener, signal } from '@angular/core';

import {
    GridReadyEvent,
    ColDef,
    GridApi,
    ModuleRegistry,
    RowApiModule,
    RowSelectionModule,
    CustomEditorModule,
    NumberEditorModule,
    TextEditorModule,
    ValidationModule,
    GetRowIdParams,
    RenderApiModule,
    RowStyleModule,
    PaginationModule,
    PinnedRowModule,
    RowClassParams,
    IServerSideDatasource,
    IServerSideGetRowsParams,
    GridOptions,
    RowModelType,
} from "ag-grid-community";

import {
    ServerSideRowModelModule,
    ServerSideRowModelApiModule
} from "ag-grid-enterprise";

import { AgGridAngular } from "ag-grid-angular";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ActionCellRenderer } from './ActionCellRenderer.component';

ModuleRegistry.registerModules([
    RowSelectionModule,
    RowApiModule,
    ValidationModule,
    NumberEditorModule,
    TextEditorModule,
    CustomEditorModule,
    RenderApiModule,
    RowStyleModule,
    PaginationModule,
    PinnedRowModule,
    ServerSideRowModelModule,
    ServerSideRowModelApiModule
]);

export interface EmployeeData {
    EmployeeID: number;
    FirstName: string;
    LastName: string;
    Department: string;
    Salary: number;
    isNew?: boolean;
    isDeleted?: boolean;
}

const EMPTY_EMPLOYEE: EmployeeData = {
    EmployeeID: 0,
    FirstName: "",
    LastName: "",
    Department: "",
    Salary: 0,
    isNew: false,
    isDeleted: false
};

const EMPLOYEES: EmployeeData[] = Array.from({ length: 200 }, (_, i) => ({
    EmployeeID: i + 1,
    FirstName: `Employee ${i + 1}`,
    LastName: `Doe`,
    Department: `Engineering`,
    Salary: 60000,
    isNew: false,
    isDeleted: false
}));

@Component({
    selector: 'app-employee',
    imports: [AgGridAngular, MatButtonModule, MatIconModule, CommonModule],
    templateUrl: './Employee.component.html',
    styleUrls: ['./Employee.component.scss']
})
export class EmployeeComponent {
    api?: GridApi<EmployeeData>;
    pinnedRows = signal<EmployeeData[]>([]);
    rowData = signal<EmployeeData[]>([]);

    rowModelType: RowModelType = 'serverSide';
    columnDefs: ColDef[] = [
        { field: 'EmployeeID', editable: true },
        { field: 'FirstName', editable: true },
        { field: 'LastName', editable: true },
        { field: 'Department', editable: true },
        { field: 'Salary', editable: true },
        {
            field: 'Actions',
            flex: 1,
            cellRenderer: ActionCellRenderer,
            cellRendererParams: {
                deleteFn: (empId: number) => this.markRowAsDeleted(empId),
                undoFn: (empId: number) => this.undoDeleteRow(empId),
            },
        }
    ];

    gridOptions: GridOptions<EmployeeData> = {
        rowModelType: this.rowModelType,
        columnDefs: this.columnDefs,
        serverSideDatasource: this.serverSideDatasource(),
        getRowId: this.getRowId,
        getRowStyle: this.getRowStyle,
        onGridReady: this.onGridReady.bind(this),
        pinnedTopRowData: this.pinnedRows(),
        pagination: true,
        paginationPageSize: 20,
        paginationPageSizeSelector: [20, 50, 100],
    }

    getRowStyle(params: RowClassParams<EmployeeData>) {
        if (params.data?.isNew === true) return { background: '#d4edda' };
        if (params.data?.isDeleted === true) return { background: '#f8d7da' };
        return { background: 'white' };
    };

    getRowId(data: GetRowIdParams<EmployeeData>) { return data.data.EmployeeID.toString() }

    onGridReady(event: GridReadyEvent) {
        this.api = event.api;
    }

    addNewRow() {
        this.pinnedRows.set([{ ...EMPTY_EMPLOYEE }, ...this.pinnedRows()]);
        setTimeout(() => {
            this.api?.startEditingCell({
                rowIndex: 0,
                colKey: 'EmployeeID',
                rowPinned: 'top'
            });
        }, 150);
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' && this.isEditMode()) {
            const pinned = this.pinnedRows().map(row => ({ ...row, isNew: true }));
            this.pinnedRows.set(pinned);
            this.addNewRow()
        }
    }

    cancelEdit() {
        this.pinnedRows.set([]);
        this.api?.getRenderedNodes().forEach(node => {
            if (node.data?.isNew || node.data?.isDeleted) {
                node.setData({ ...node.data, isDeleted: false, isNew: false });
            }
        })
    }

    markRowAsDeleted(employeeId: number) {
        this.updateRowData(employeeId, true);
    }

    undoDeleteRow(employeeId: number) {
        this.updateRowData(employeeId, false);
    }

    private updateRowData(employeeId: number, isDeleted: boolean) {
        const row = this.rowData().find(row => row.EmployeeID === employeeId);
        if (row) {
            this.api?.getRowNode(employeeId.toString())?.setData({ ...row, isDeleted });
        }

        if (isDeleted) {
            this.pinnedRows.set(this.pinnedRows().filter(row => row.EmployeeID !== employeeId));
        }
    }

    saveChanges() {
        const newRows = this.pinnedRows().filter(row => row.isNew);
        console.info("New Rows", newRows);
        const deletedRows = this.api?.getRenderedNodes().filter(row => row.data?.isDeleted);
        console.info("Deleted Rows", deletedRows);

        this.pinnedRows.set([]);

        this.api?.getRenderedNodes().forEach(node => {
            if (node.data?.isNew || node.data?.isDeleted) {
                node.setData({ ...node.data, isDeleted: false, isNew: false });
            }
        });
    }

    isEditMode() {
        const isDeleted = this.api?.getRenderedNodes()
            .find(node => node.data?.isNew || node.data?.isDeleted);

        return this.pinnedRows().length > 0 || isDeleted;
    }

    serverSideDatasource(): IServerSideDatasource {
        return {
            getRows: (params: IServerSideGetRowsParams<EmployeeData>) => {
                console.log('Requesting rows from server', params.request);
                const startRow = params.request.startRow;
                if (startRow !== undefined) {
                    const data = EMPLOYEES.slice(startRow, params.request.endRow);
                    this.rowData.set([...this.rowData(), ...data]);
                    params.success({ rowData: data });
                }
            }
        };
    }

}